import { CubeIcon, ServiceIcon, ThumbtackIcon, QuestionCircleIcon, OutlinedHddIcon } from '@patternfly/react-icons';
import {
  Decorator,
  DefaultNode,
  DEFAULT_DECORATOR_RADIUS,
  getDefaultShapeDecoratorCenter,
  Node,
  NodeShape,
  observer,
  ScaleDetailsLevel,
  ShapeProps,
  TopologyQuadrant,
  WithContextMenuProps,
  WithDragNodeProps,
  WithSelectionProps
} from '@patternfly/react-topology';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import * as React from 'react';

export enum DataTypes {
  Default
}
const ICON_PADDING = 20;

type StyleNodeProps = {
  element: Node;
  getCustomShape?: (node: Node) => React.FC<ShapeProps>;
  getShapeDecoratorCenter?: (quadrant: TopologyQuadrant, node: Node, radius?: number) => { x: number; y: number };
  showLabel?: boolean;
  showStatusDecorator?: boolean;
  regrouping?: boolean;
  dragging?: boolean;
} & WithContextMenuProps &
  WithDragNodeProps &
  WithSelectionProps;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTypeIcon = (dataType?: string): React.ComponentClass<any, any> => {
  switch (dataType?.toLowerCase()) {
    case 'service':
      return ServiceIcon;
    case 'pod':
      return CubeIcon;
    case 'node':
      return OutlinedHddIcon;
    default:
      return QuestionCircleIcon;
  }
};

const getTypeIconColor = (dataType?: string): string => {
  switch (dataType?.toLowerCase()) {
    case 'service':
    case 'pod':
    case 'node':
      return '#393F44';
    default:
      return '#c9190b';
  }
};

const renderIcon = (data: { type?: string }, element: Node): React.ReactNode => {
  const { width, height } = element.getDimensions();
  const shape = element.getNodeShape();
  const iconSize =
    (shape === NodeShape.trapezoid ? width : Math.min(width, height)) -
    (shape === NodeShape.stadium ? 5 : ICON_PADDING) * 2;
  const Component = getTypeIcon(data.type);
  const color = getTypeIconColor(data.type);

  return (
    <g transform={`translate(${(width - iconSize) / 2}, ${(height - iconSize) / 2})`}>
      <Component style={{ color }} width={iconSize} height={iconSize} />
    </g>
  );
};

const renderDecorator = (
  element: Node,
  quadrant: TopologyQuadrant,
  icon: React.ReactNode,
  getShapeDecoratorCenter?: (
    quadrant: TopologyQuadrant,
    node: Node,
    radius?: number
  ) => {
    x: number;
    y: number;
  }
): React.ReactNode => {
  const { x, y } = getShapeDecoratorCenter
    ? getShapeDecoratorCenter(quadrant, element)
    : getDefaultShapeDecoratorCenter(quadrant, element);

  return <Decorator x={x} y={y} radius={DEFAULT_DECORATOR_RADIUS} showBackground icon={icon} />;
};

const renderDecorators = (
  element: Node,
  data: { showDecorators?: boolean },
  getShapeDecoratorCenter?: (
    quadrant: TopologyQuadrant,
    node: Node,
    radius?: number
  ) => {
    x: number;
    y: number;
  }
): React.ReactNode => {
  if (!data.showDecorators) {
    return null;
  }
  /*TODO: implement decorators for quick filters / pin or other actions*/
  return <>{renderDecorator(element, TopologyQuadrant.lowerRight, <ThumbtackIcon />, getShapeDecoratorCenter)}</>;
};

export const StyleNode: React.FC<StyleNodeProps> = ({
  element,
  onContextMenu,
  contextMenuOpen,
  showLabel,
  dragging,
  regrouping,
  ...rest
}) => {
  const data = element.getData();
  const detailsLevel = useDetailsLevel();

  const passedData = React.useMemo(() => {
    const newData = { ...data };
    Object.keys(newData).forEach(key => {
      if (newData[key] === undefined) {
        delete newData[key];
      }
    });
    return newData;
  }, [data]);

  return (
    <DefaultNode
      element={element}
      {...rest}
      {...passedData}
      dragging={dragging}
      regrouping={regrouping}
      showLabel={detailsLevel === ScaleDetailsLevel.high && showLabel}
      showStatusBackground={detailsLevel === ScaleDetailsLevel.low}
      showStatusDecorator={detailsLevel === ScaleDetailsLevel.high && passedData.showStatusDecorator}
      onContextMenu={data.showContextMenu ? onContextMenu : undefined}
      contextMenuOpen={contextMenuOpen}
      attachments={
        detailsLevel === ScaleDetailsLevel.high && renderDecorators(element, passedData, rest.getShapeDecoratorCenter)
      }
    >
      {detailsLevel !== ScaleDetailsLevel.low && renderIcon(passedData, element)}
    </DefaultNode>
  );
};

export default observer(StyleNode);
