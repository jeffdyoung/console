import * as _ from 'lodash';
import * as k8s from '@console/internal/module/k8s';
import { getPodStatus, podStatus, getImageForCSVIcon } from '@console/shared';
import {
  getKnativeServingRevisions,
  getKnativeServingConfigurations,
  getKnativeServingRoutes,
} from '@console/knative-plugin/src/utils/get-knative-resources';
import { getImageForIconClass } from '@console/internal/components/catalog/catalog-item-icon';
import { WorkloadData, TopologyDataResources } from '../topology-types';
import {
  transformTopologyData,
  getEditURL,
  topologyModelFromDataModel,
  getTopologyResourceObject,
  createTopologyResourceConnection,
} from '../topology-utils';
import { DEFAULT_TOPOLOGY_FILTERS } from '../redux/const';
import { TopologyFilters } from '../filters/filter-utils';
import {
  resources,
  topologyData,
  MockResources,
  topologyDataModel,
  dataModel,
  sampleDeployments,
} from './topology-test-data';
import { MockKnativeResources } from './topology-knative-test-data';
import { serviceBindingRequest } from './service-binding-test-data';

export function getTranformedTopologyData(
  mockData: TopologyDataResources,
  transformByProp: string[],
  mockCheURL?: string,
  filters?: TopologyFilters,
) {
  const result = transformTopologyData(
    mockData,
    transformByProp,
    undefined,
    mockCheURL,
    [getKnativeServingRevisions, getKnativeServingConfigurations, getKnativeServingRoutes],
    filters,
  );
  const topologyTransformedData = result.topology;
  const graphData = result.graph;
  return { topologyTransformedData, graphData, keys: Object.keys(topologyTransformedData) };
}

describe('TopologyUtils ', () => {
  it('should be able to create an object', () => {
    expect(transformTopologyData(resources, ['deployments'])).toBeTruthy();
  });

  it('should return graph and topology data', () => {
    expect(transformTopologyData(resources, ['deployments'])).toEqual(topologyData);
  });

  it('should return topology model data', () => {
    const newModel = topologyModelFromDataModel(topologyDataModel);
    expect(newModel).toEqual(dataModel);
  });

  it('should return topology resource object', () => {
    const topologyResourceObject = getTopologyResourceObject(
      topologyDataModel.topology['e187afa2-53b1-406d-a619-cf9ff1468031'],
    );
    expect(topologyResourceObject).toEqual(sampleDeployments.data[0]);
  });

  it('should return graph and topology data only for the deployment kind', () => {
    const { graphData, keys } = getTranformedTopologyData(MockResources, ['deployments']);
    expect(graphData.nodes).toHaveLength(MockResources.deployments.data.length); // should contain only two deployment
    expect(keys).toHaveLength(MockResources.deployments.data.length); // should contain only two deployment
  });

  it('should contain edges information for the deployment kind', () => {
    const { graphData } = getTranformedTopologyData(MockResources, ['deployments']);
    // check if edges are connected between analytics -> wit
    expect(graphData.edges.length).toEqual(1); // should contain only one edges
    expect(graphData.edges[0].source).toEqual(MockResources.deployments.data[0].metadata.uid); // analytics
    expect(graphData.edges[0].target).toEqual(MockResources.deployments.data[1].metadata.uid); // wit
  });

  it('should return graph and topology data only for the deploymentConfig kind', () => {
    const { graphData, keys } = getTranformedTopologyData(MockResources, ['deploymentConfigs']);
    expect(graphData.nodes.length).toEqual(MockResources.deploymentConfigs.data.length); // should contain only two deployment
    expect(keys.length).toEqual(MockResources.deploymentConfigs.data.length); // should contain only two deployment
  });

  it('should not have group information if the `part-of` label is missing', () => {
    const { graphData } = getTranformedTopologyData(MockResources, ['deploymentConfigs']);
    expect(graphData.groups).toHaveLength(0);
  });

  it('should match the previous snapshot', () => {
    expect(
      transformTopologyData(MockResources, ['deployments', 'deploymentConfigs']),
    ).toMatchSnapshot();
  });

  it('should return a valid pod status', () => {
    const { topologyTransformedData, keys } = getTranformedTopologyData(MockResources, [
      'deploymentConfigs',
      'deployments',
    ]);
    const status = getPodStatus(
      (topologyTransformedData[keys[0]].data as WorkloadData).donutStatus.pods[0],
    );
    expect(podStatus.includes(status)).toBe(true);
  });

  it('should return empty pod list in TopologyData in case of no pods', () => {
    const knativeMockResp = { ...MockResources, pods: { loaded: true, loadError: '', data: [] } };
    const { topologyTransformedData, keys } = getTranformedTopologyData(knativeMockResp, [
      'deploymentConfigs',
      'deployments',
    ]);
    expect((topologyTransformedData[keys[0]].data as WorkloadData).donutStatus.pods).toHaveLength(
      0,
    );
  });

  it('should return a Idle pod status in a non-serverless application', () => {
    // simulate pod are scaled to zero in nodejs deployment.
    const mockResources = {
      ..._.cloneDeep(MockResources),
      pods: { loaded: true, loadError: '', data: [] },
    };
    mockResources.deploymentConfigs.data[0].metadata.annotations = {
      'idling.alpha.openshift.io/idled-at': '2019-04-22T11:58:33Z',
    };
    const { topologyTransformedData, keys } = getTranformedTopologyData(mockResources, [
      'deploymentConfigs',
    ]);
    const status = getPodStatus(
      (topologyTransformedData[keys[0]].data as WorkloadData).donutStatus.pods[0],
    );
    expect(podStatus.includes(status)).toBe(true);
    expect(status).toEqual('Idle');
  });

  it('should return false for non knative resource', () => {
    const mockResources = { ...MockResources, pods: { loaded: true, loadError: '', data: [] } };
    const { topologyTransformedData, keys } = getTranformedTopologyData(mockResources, [
      'deploymentConfigs',
      'deployments',
    ]);
    expect((topologyTransformedData[keys[0]].data as WorkloadData).isKnativeResource).toBeFalsy();
  });

  it('should return a valid pod status for scale to 0', () => {
    const { topologyTransformedData } = getTranformedTopologyData(MockKnativeResources, [
      'deploymentConfigs',
      'deployments',
    ]);
    const status = getPodStatus(
      (topologyTransformedData['02c34a0e-9638-11e9-b134-06a61d886b62'].data as WorkloadData)
        .donutStatus.pods[0],
    );
    expect(podStatus.includes(status)).toBe(true);
    expect(status).toEqual('Autoscaled to 0');
  });

  it('should return true for knative resource', () => {
    const { topologyTransformedData, keys } = getTranformedTopologyData(MockKnativeResources, [
      'deploymentConfigs',
      'deployments',
    ]);
    expect((topologyTransformedData[keys[0]].data as WorkloadData).isKnativeResource).toBeTruthy();
  });

  it('should return a valid daemon set', () => {
    const { topologyTransformedData, graphData, keys } = getTranformedTopologyData(MockResources, [
      'daemonSets',
    ]);
    expect(graphData.nodes).toHaveLength(1);
    expect(topologyTransformedData[keys[0]].resources.obj.kind).toEqual('DaemonSet');
  });
  it('should return a daemon set pod ', () => {
    const { topologyTransformedData, graphData, keys } = getTranformedTopologyData(MockResources, [
      'daemonSets',
    ]);
    expect(graphData.nodes).toHaveLength(1);
    expect((topologyTransformedData[keys[0]].data as WorkloadData).donutStatus.pods).toHaveLength(
      1,
    );
  });

  it('should return knative routes for knative resource', () => {
    const { topologyTransformedData } = getTranformedTopologyData(MockKnativeResources, [
      'deploymentConfigs',
      'deployments',
    ]);
    expect(
      (topologyTransformedData['cea9496b-8ce0-11e9-bb7b-0ebb55b110b8'].data as WorkloadData).url,
    ).toEqual('http://overlayimage.knativeapps.apps.bpetersen-june-23.devcluster.openshift.com');
  });

  it('should return revision resources for knative workloads', () => {
    const { topologyTransformedData } = getTranformedTopologyData(MockKnativeResources, [
      'deploymentConfigs',
      'deployments',
    ]);
    const revRes =
      topologyTransformedData['cea9496b-8ce0-11e9-bb7b-0ebb55b110b8'].resources.revisions;
    expect(revRes.length).toEqual(1);
  });

  it('should return Configuration resources for knative workloads', () => {
    const { topologyTransformedData } = getTranformedTopologyData(MockKnativeResources, [
      'deploymentConfigs',
      'deployments',
    ]);
    const configRes =
      topologyTransformedData['cea9496b-8ce0-11e9-bb7b-0ebb55b110b8'].resources.configurations;
    expect(configRes).toHaveLength(1);
  });

  it('should return a valid stateful set', () => {
    const { topologyTransformedData, graphData, keys } = getTranformedTopologyData(MockResources, [
      'statefulSets',
    ]);
    expect(graphData.nodes).toHaveLength(1);
    expect(topologyTransformedData[keys[0]].resources.obj.kind).toEqual('StatefulSet');
  });
  it('should return a stateful set pod ', () => {
    const { topologyTransformedData, graphData, keys } = getTranformedTopologyData(MockResources, [
      'statefulSets',
    ]);
    expect(graphData.nodes).toHaveLength(1);
    expect((topologyTransformedData[keys[0]].data as WorkloadData).donutStatus.pods).toHaveLength(
      1,
    );
  });

  it('should return a valid che workspace factory URL if cheURL is there', () => {
    const mockCheURL = 'https://mock-che.test-cluster.com';
    const mockGitURL =
      MockResources.deploymentConfigs.data[0].metadata.annotations['app.openshift.io/vcs-uri'];
    const { topologyTransformedData, keys } = getTranformedTopologyData(
      MockResources,
      ['deploymentConfigs'],
      mockCheURL,
    );
    const generatedEditURL = getEditURL(mockGitURL, mockCheURL);
    expect((topologyTransformedData[keys[0]].data as WorkloadData).editUrl).toBe(generatedEditURL);
  });

  it('should return the git repo URL if cheURL is not there', () => {
    const mockGitURL =
      MockResources.deploymentConfigs.data[0].metadata.annotations['app.openshift.io/vcs-uri'];
    const { topologyTransformedData, keys } = getTranformedTopologyData(MockResources, [
      'deploymentConfigs',
    ]);
    expect((topologyTransformedData[keys[0]].data as WorkloadData).editUrl).toBe(mockGitURL);
  });

  it('should return builder image icon for nodejs', () => {
    const nodejsIcon = getImageForIconClass('icon-nodejs');
    const { topologyTransformedData, keys } = getTranformedTopologyData(MockResources, [
      'deploymentConfigs',
    ]);
    expect((topologyTransformedData[keys[0]].data as WorkloadData).builderImage).toBe(nodejsIcon);
  });

  it('should return csv icon for operator backed service', () => {
    const icon = _.get(MockResources.clusterServiceVersions.data[0], 'spec.icon.0');
    const csvIcon = getImageForCSVIcon(icon);
    const { topologyTransformedData, keys } = getTranformedTopologyData(MockResources, [
      'deployments',
    ]);
    expect((topologyTransformedData[keys[2]].data as WorkloadData).builderImage).toBe(csvIcon);
  });

  it('should not render event sources if corresponding filter returns false', () => {
    const eventFilter: TopologyFilters = _.set(
      _.cloneDeep(DEFAULT_TOPOLOGY_FILTERS),
      'display.eventSources',
      false,
    );
    const { topologyTransformedData } = getTranformedTopologyData(
      MockKnativeResources,
      [],
      '',
      eventFilter,
    );
    expect(topologyTransformedData['1317f615-9636-11e9-b134-06a61d886b689']).toBe(undefined);
  });
  it('should render event sources if corresponding filter returns true', () => {
    const eventFilter: TopologyFilters = _.cloneDeep(DEFAULT_TOPOLOGY_FILTERS);
    const { topologyTransformedData } = getTranformedTopologyData(
      MockKnativeResources,
      [],
      '',
      eventFilter,
    );
    expect(topologyTransformedData['1317f615-9636-11e9-b134-06a61d886b689'].type).toBe(
      'event-source',
    );
  });
});

describe('Topology Utils', () => {
  beforeAll(() => {
    jest.spyOn(k8s, 'k8sCreate').mockImplementation((data) => Promise.resolve({ data }));
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should create topology resource service binding', (done) => {
    const source = topologyDataModel.topology['e187afa2-53b1-406d-a619-cf9ff1468031'];
    const target = topologyDataModel.topology['e187afa2-53b1-406d-a619-cf9ff1468032'];
    createTopologyResourceConnection(source, target, null, true)
      .then((resp) => {
        const data = _.get(resp, 'data');
        expect(data).toEqual(serviceBindingRequest.data);
        done();
      })
      .catch(() => {
        done();
      });
  });
});
