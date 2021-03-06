import * as React from 'react';
import { observer } from 'mobx-react';
import { polygonHull } from 'd3-polygon';
import * as _ from 'lodash';
import {
  WithDragNodeProps,
  WithSelectionProps,
  Layer,
  Node,
  PointTuple,
  GroupStyle,
  NodeShape,
  WithDndDragProps,
  WithDndDropProps,
  useCombineRefs,
  maxPadding,
  hullPath,
} from '../../src';

type GroupHullProps = {
  element: Node;
  droppable?: boolean;
  hover?: boolean;
  canDrop?: boolean;
} & WithSelectionProps &
  WithDragNodeProps &
  WithDndDragProps &
  WithDndDropProps;

type PointWithSize = PointTuple | [number, number, number];

const GroupHull: React.FC<GroupHullProps> = ({
  element,
  children,
  selected,
  onSelect,
  dragNodeRef,
  dndDragRef,
  dndDropRef,
  hover,
  droppable,
  canDrop,
}) => {
  const pathRef = React.useRef<string | null>(null);
  const refs = useCombineRefs<SVGPathElement>(dragNodeRef, dndDragRef, dndDropRef);

  if (!droppable || !pathRef.current) {
    const nodeChildren = element.getNodes();
    if (nodeChildren.length === 0) {
      return null;
    }
    const points: PointWithSize[] = [];
    _.forEach(nodeChildren, (c) => {
      if (c.getNodeShape() === NodeShape.circle) {
        const { width, height } = c.getBounds();
        const { x, y } = c.getBounds().getCenter();
        const radius = Math.max(width, height) / 2;
        points.push([x, y, radius] as PointWithSize);
      } else {
        // add all 4 corners
        const { width, height, x, y } = c.getBounds();
        points.push([x, y, 0] as PointWithSize);
        points.push([x + width, y, 0] as PointWithSize);
        points.push([x, y + height, 0] as PointWithSize);
        points.push([x + width, y + height, 0] as PointWithSize);
      }
    });
    const hullPoints: PointTuple[] | null =
      points.length > 2 ? polygonHull(points as PointTuple[]) : (points as PointTuple[]);
    if (!hullPoints) {
      return null;
    }

    // cast to number and coerce
    const padding = maxPadding(element.getStyle<GroupStyle>().padding);
    const hullPadding = (point: PointWithSize) => (point[2] || 0) + padding;
    // change the box only when not dragging
    pathRef.current = hullPath(hullPoints, hullPadding);
  }

  return (
    <Layer id="groups">
      <path
        ref={refs}
        onClick={onSelect}
        d={pathRef.current}
        fill={canDrop && hover ? 'lightgreen' : canDrop && droppable ? 'lightblue' : '#ededed'}
        strokeWidth={2}
        stroke={selected ? 'blue' : '#cdcdcd'}
      />
      {children}
    </Layer>
  );
};

export default observer(GroupHull);
