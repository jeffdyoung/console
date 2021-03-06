/* eslint-disable lines-between-class-members */
import { ValueEnum } from '../../value-enum';
import { NetworkInterfaceType } from './network-interface-type';

export class NetworkType extends ValueEnum<string> {
  static readonly MULTUS = new NetworkType('multus', NetworkInterfaceType.BRIDGE, [
    NetworkInterfaceType.BRIDGE,
    NetworkInterfaceType.SRIOV,
  ]);
  static readonly POD = new NetworkType('pod', NetworkInterfaceType.MASQUERADE, [
    NetworkInterfaceType.MASQUERADE,
    NetworkInterfaceType.BRIDGE,
    NetworkInterfaceType.SRIOV,
  ]);
  static readonly GENIE = new NetworkType('genie', NetworkInterfaceType.BRIDGE, [
    NetworkInterfaceType.BRIDGE,
  ]);

  private static ALL = Object.freeze(ValueEnum.getAllClassEnumProperties<NetworkType>(NetworkType));

  private static stringMapper = NetworkType.ALL.reduce(
    (accumulator, networkType: NetworkType) => ({
      ...accumulator,
      [networkType.value]: networkType,
    }),
    {},
  );

  static getAll = () => NetworkType.ALL;

  static fromString = (model: string): NetworkType => NetworkType.stringMapper[model];

  static fromSerialized = (networkType: { value: string }): NetworkType =>
    NetworkType.fromString(networkType && networkType.value);

  private readonly defaultInterfaceType: NetworkInterfaceType;
  private readonly allowedInterfaceTypes: Readonly<NetworkInterfaceType[]>;
  private readonly allowedInterfaceTypesSet: Set<NetworkInterfaceType>;

  private constructor(
    value?: string,
    defaultInterfaceType?: NetworkInterfaceType,
    allowedInterfaceTypes?: NetworkInterfaceType[],
  ) {
    super(value);
    this.defaultInterfaceType = defaultInterfaceType;
    this.allowedInterfaceTypes = Object.freeze(allowedInterfaceTypes);
    this.allowedInterfaceTypesSet = new Set(allowedInterfaceTypes);
  }

  getDefaultInterfaceType = () => this.defaultInterfaceType;
  getAllowedInterfaceTypes = () => this.allowedInterfaceTypes;
  allowsInterfaceType = (interfaceType: NetworkInterfaceType) =>
    this.allowedInterfaceTypesSet.has(interfaceType);
}
