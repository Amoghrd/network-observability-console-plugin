import { K8sModel } from '@openshift-console/dynamic-plugin-sdk';
import { Bullseye, Spinner, ValidatedOptions } from '@patternfly/react-core';
import {
  createTopologyControlButtons,
  defaultControlButtonsOptions,
  GRAPH_LAYOUT_END_EVENT,
  GRAPH_POSITION_CHANGE_EVENT,
  Model,
  Node,
  SelectionEventListener,
  SELECTION_EVENT,
  TopologyControlBar,
  TopologyView,
  useEventListener,
  useVisualizationController,
  Visualization,
  VisualizationProvider,
  VisualizationSurface
} from '@patternfly/react-topology';
import _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { TopologyMetrics } from '../../api/loki';
import { Filter } from '../../model/filters';
import { MetricFunction, MetricScope, MetricType } from '../../model/flow-query';
import { MetricScopeOptions } from '../../model/metrics';
import {
  Decorated,
  ElementData,
  generateDataModel,
  getStat,
  GraphElementPeer,
  isElementFiltered,
  LayoutName,
  toggleElementFilter,
  TopologyGroupTypes,
  TopologyOptions
} from '../../model/topology';
import { TimeRange } from '../../utils/datetime';
import { usePrevious } from '../../utils/previous-hook';
import LokiError from '../messages/loki-error';
import { SearchEvent, SearchHandle } from '../search/search';
import componentFactory from './componentFactories/componentFactory';
import stylesComponentFactory from './componentFactories/stylesComponentFactory';
import layoutFactory from './layouts/layoutFactory';
import './netflow-topology.css';
import { FILTER_EVENT, STEP_INTO_EVENT } from './styles/styleNode';

export const HOVER_EVENT = 'hover';

let requestFit = false;
let waitForMetrics = false;
let lastNodeIdsFound: string[] = [];

const ZOOM_IN = 4 / 3;
const ZOOM_OUT = 3 / 4;
const FIT_PADDING = 80;

export const TopologyContent: React.FC<{
  k8sModels: { [key: string]: K8sModel };
  range: number | TimeRange;
  metricFunction: MetricFunction;
  metricType: MetricType;
  metricScope: MetricScope;
  setMetricScope: (ms: MetricScope) => void;
  metrics: TopologyMetrics[];
  options: TopologyOptions;
  setOptions: (o: TopologyOptions) => void;
  filters: Filter[];
  setFilters: (v: Filter[]) => void;
  selected: GraphElementPeer | undefined;
  onSelect: (e: GraphElementPeer | undefined) => void;
  searchHandle: SearchHandle | null;
  searchEvent?: SearchEvent;
  isDark?: boolean;
}> = ({
  k8sModels,
  range,
  metricFunction,
  metricType,
  metricScope,
  setMetricScope,
  metrics,
  options,
  setOptions,
  filters,
  setFilters,
  selected,
  onSelect,
  searchHandle,
  searchEvent,
  isDark
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const controller = useVisualizationController();
  const prevMetrics = usePrevious(metrics);
  const prevMetricFunction = usePrevious(metricFunction);
  const prevMetricType = usePrevious(metricType);
  const prevMetricScope = usePrevious(metricScope);
  const prevOptions = usePrevious(options);

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [hoveredId, setHoveredId] = React.useState<string>('');

  const onSelectIds = React.useCallback(
    (ids: string[]) => {
      setSelectedIds(ids);
      onSelect(ids.length ? controller.getElementById(ids[0]) : undefined);
    },
    [controller, onSelect]
  );

  //search element by label or secondaryLabel
  const onSearch = React.useCallback(
    (searchValue: string, next = true) => {
      if (!searchHandle || _.isEmpty(searchValue)) {
        return;
      }

      if (controller && controller.hasGraph()) {
        const currentModel = controller.toModel();
        const matchingNodeModels =
          currentModel.nodes?.filter(
            n => n.label?.includes(searchValue) || n.data?.secondaryLabel?.includes(searchValue)
          ) || [];

        if (next) {
          //go back to first match if last item is reached
          if (lastNodeIdsFound.length === matchingNodeModels.length) {
            lastNodeIdsFound = [];
          }
        } else {
          if (lastNodeIdsFound.length === 1) {
            //fill matching ids except last
            lastNodeIdsFound = matchingNodeModels.map(n => n.id);
            lastNodeIdsFound.splice(-1);
          } else {
            //remove previous match
            lastNodeIdsFound.splice(-2);
          }
        }

        const nodeModelsFound = matchingNodeModels.filter(n => !lastNodeIdsFound.includes(n.id));
        const nodeFound = !_.isEmpty(nodeModelsFound) ? controller.getNodeById(nodeModelsFound![0].id) : undefined;
        if (nodeFound) {
          const id = nodeFound.getId();
          onSelectIds([id]);
          lastNodeIdsFound.push(id);
          searchHandle.updateIndicators(
            `${lastNodeIdsFound.length}/${lastNodeIdsFound.length + nodeModelsFound!.length - 1}`,
            ValidatedOptions.success
          );
          const bounds = controller.getGraph().getBounds();
          controller.getGraph().panIntoView(nodeFound, {
            offset: Math.min(bounds.width, bounds.height) / 2,
            minimumVisible: 100
          });
        } else {
          lastNodeIdsFound = [];
          searchHandle.updateIndicators('', ValidatedOptions.error);
          onSelectIds([]);
        }
      } else {
        console.error('searchElement called before controller graph');
      }
    },
    [controller, onSelectIds, searchHandle]
  );

  const onChangeSearch = () => {
    lastNodeIdsFound = [];
  };

  const onFilter = React.useCallback(
    (data: Decorated<ElementData>) => {
      const isFiltered = isElementFiltered(data, filters, t);
      toggleElementFilter(data, isFiltered, filters, setFilters, t);
      setSelectedIds([data.id]);
    },
    [filters, setFilters, t]
  );

  const onStepInto = React.useCallback(
    (data: Decorated<ElementData>) => {
      let scope: MetricScopeOptions;
      let groupTypes: TopologyGroupTypes;
      switch (metricScope) {
        case MetricScopeOptions.HOST:
          scope = MetricScopeOptions.NAMESPACE;
          groupTypes = TopologyGroupTypes.NONE;
          break;
        case MetricScopeOptions.NAMESPACE:
          scope = MetricScopeOptions.OWNER;
          groupTypes = TopologyGroupTypes.NAMESPACES;
          break;
        default:
          scope = MetricScopeOptions.RESOURCE;
          groupTypes = TopologyGroupTypes.OWNERS;
      }
      setMetricScope(scope);
      setOptions({
        ...options,
        groupTypes
      });
      onFilter({
        ...data,
        isFiltered: true,
        isClearFilters: true
      });
      //clear search
      onChangeSearch();
      //clear selection
      onSelect(undefined);
    },
    [metricScope, onFilter, onSelect, options, setMetricScope, setOptions]
  );

  const onHover = React.useCallback((data: Decorated<ElementData>) => {
    setHoveredId(data.isHovered ? data.id : '');
  }, []);

  //fit view to elements
  const fitView = React.useCallback(() => {
    if (controller && controller.hasGraph()) {
      controller.getGraph().fit(FIT_PADDING);
    } else {
      console.error('fitView called before controller graph');
    }
  }, [controller]);

  const onLayoutEnd = React.useCallback(() => {
    //fit view to new loaded elements
    if (requestFit) {
      requestFit = false;
      if ([LayoutName.Concentric, LayoutName.Dagre, LayoutName.Grid].includes(options.layout)) {
        fitView();
      } else {
        //TODO: find a smoother way to fit while elements are still moving
        setTimeout(fitView, 100);
        setTimeout(fitView, 250);
        setTimeout(fitView, 500);
      }
    }
  }, [fitView, options.layout]);

  const onLayoutPositionChange = React.useCallback(() => {
    if (controller && controller.hasGraph()) {
      //hide popovers on pan / zoom
      const popover = document.querySelector('[aria-labelledby="popover-decorator-header"]');
      if (popover) {
        (popover as HTMLElement).style.display = 'none';
      }
    }
  }, [controller]);

  //get options with updated time range and max edge value
  const getOptions = React.useCallback(() => {
    let rangeInSeconds: number;
    if (typeof range === 'number') {
      rangeInSeconds = range;
    } else {
      rangeInSeconds = (range.from - range.to) / 1000;
    }
    const maxEdgeStat = Math.max(...metrics.map(m => getStat(m.stats, metricFunction)));
    return {
      ...options,
      rangeInSeconds,
      maxEdgeStat,
      metricFunction,
      metricType
    } as TopologyOptions;
  }, [range, metrics, options, metricFunction, metricType]);

  //update graph details level
  const setDetailsLevel = React.useCallback(() => {
    if (controller && controller.hasGraph()) {
      controller.getGraph().setDetailsLevelThresholds({
        low: options.lowScale,
        medium: options.medScale
      });
    }
  }, [controller, options.lowScale, options.medScale]);

  //reset graph and model
  const resetGraph = React.useCallback(() => {
    if (controller) {
      const model: Model = {
        graph: {
          id: 'g1',
          type: 'graph',
          layout: options.layout
        }
      };
      controller.fromModel(model, false);
      setDetailsLevel();
    }
  }, [controller, options.layout, setDetailsLevel]);

  //update details on low / med scale change
  React.useEffect(() => {
    setDetailsLevel();
  }, [controller, options.lowScale, options.medScale, setDetailsLevel]);

  //update model merging existing nodes / edges
  const updateModel = React.useCallback(() => {
    if (!controller) {
      return;
    } else if (!controller.hasGraph()) {
      console.error('updateModel called while controller has no graph');
    } else if (waitForMetrics && prevMetrics === metrics) {
      return;
    }
    waitForMetrics = false;

    //highlight either hoveredId or selected id
    let highlightedId = hoveredId;
    if (!highlightedId && selectedIds.length === 1) {
      highlightedId = selectedIds[0];
    }

    const updatedModel = generateDataModel(
      metrics,
      getOptions(),
      metricScope,
      searchEvent?.searchValue || '',
      highlightedId,
      filters,
      t,
      k8sModels,
      isDark
    );
    const allIds = [...(updatedModel.nodes || []), ...(updatedModel.edges || [])].map(item => item.id);
    controller.getElements().forEach(e => {
      if (e.getType() !== 'graph') {
        if (allIds.includes(e.getId())) {
          //keep previous data
          switch (e.getType()) {
            case 'node':
              const updatedNode = updatedModel.nodes?.find(n => n.id === e.getId());
              if (updatedNode) {
                updatedNode.data = { ...e.getData(), ...updatedNode.data };
              }
              break;
            case 'group':
              const updatedGroup = updatedModel.nodes?.find(n => n.id === e.getId());
              if (updatedGroup) {
                updatedGroup.collapsed = (e as Node).isCollapsed();
              }
              break;
          }
        } else {
          controller.removeElement(e);
        }
      }
    });
    controller.fromModel(updatedModel);
  }, [
    controller,
    prevMetrics,
    metrics,
    hoveredId,
    selectedIds,
    getOptions,
    metricScope,
    searchEvent?.searchValue,
    filters,
    t,
    k8sModels,
    isDark
  ]);

  //update model on layout / metrics / filters change
  React.useEffect(() => {
    //update graph
    if (
      !controller.hasGraph() ||
      prevOptions?.layout !== options.layout ||
      prevOptions?.groupTypes !== options.groupTypes ||
      prevOptions.startCollapsed !== options.startCollapsed
    ) {
      resetGraph();
    }

    //skip refresh if scope / group changed. It will refresh after getting new metrics
    if (prevOptions && (prevMetricScope !== metricScope || prevOptions.groupTypes !== options.groupTypes)) {
      waitForMetrics = true;
      return;
    }

    //then update model
    updateModel();
  }, [controller, metrics, filters, options, prevOptions, resetGraph, updateModel, prevMetricScope, metricScope]);

  //request fit on layout end when filter / options change
  React.useEffect(() => {
    requestFit = true;
  }, [filters, options]);

  //clear existing edge tags on query change before getting new metrics
  React.useEffect(() => {
    if (controller && controller.hasGraph()) {
      if (prevMetricFunction !== metricFunction || prevMetricType !== metricType) {
        //remove edge tags on metrics change
        controller.getElements().forEach(e => {
          if (e.getType() === 'edge') {
            e.setData({ ...e.getData(), tag: undefined });
          }
        });
      }
    }
  }, [controller, metricFunction, metricType, prevMetricFunction, prevMetricType]);

  //refresh UI selected items
  React.useEffect(() => {
    const elementId = selected?.getId();
    const selectedId = _.isEmpty(selectedIds) ? undefined : selectedIds[0];
    if (elementId !== selectedId) {
      setSelectedIds(elementId ? [elementId] : []);
    }
  }, [selected, selectedIds]);

  React.useEffect(() => {
    if (searchHandle && searchEvent) {
      switch (searchEvent.type) {
        case 'change':
          onChangeSearch();
          break;
        case 'searchNext':
          onSearch(searchEvent.searchValue, true);
          break;
        case 'searchPrevious':
          onSearch(searchEvent.searchValue, false);
          break;
        default:
          throw new Error('unimplemented search type ' + searchEvent.type);
      }
    }
    // only trigger this on event change to avoid looping
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchEvent]);

  useEventListener<SelectionEventListener>(SELECTION_EVENT, onSelectIds);
  useEventListener(FILTER_EVENT, onFilter);
  useEventListener(STEP_INTO_EVENT, onStepInto);
  useEventListener(HOVER_EVENT, onHover);
  useEventListener(GRAPH_LAYOUT_END_EVENT, onLayoutEnd);
  useEventListener(GRAPH_POSITION_CHANGE_EVENT, onLayoutPositionChange);

  return (
    <TopologyView
      data-test="topology-view"
      controlBar={
        <TopologyControlBar
          data-test="topology-control-bar"
          controlButtons={createTopologyControlButtons({
            ...defaultControlButtonsOptions,
            fitToScreen: false,
            zoomInCallback: () => {
              controller && controller.getGraph().scaleBy(ZOOM_IN);
            },
            zoomOutCallback: () => {
              controller && controller.getGraph().scaleBy(ZOOM_OUT);
            },
            resetViewCallback: () => {
              if (controller) {
                requestFit = true;
                controller.getGraph().reset();
                controller.getGraph().layout();
              }
            },
            //TODO: enable legend with display icons and colors
            legend: false
          })}
        />
      }
    >
      <VisualizationSurface data-test="visualization-surface" state={{ selectedIds }} />
    </TopologyView>
  );
};

export const NetflowTopology: React.FC<{
  loading?: boolean;
  k8sModels: { [key: string]: K8sModel };
  error?: string;
  range: number | TimeRange;
  metricFunction: MetricFunction;
  metricType: MetricType;
  metricScope: MetricScope;
  setMetricScope: (ms: MetricScope) => void;
  metrics: TopologyMetrics[];
  options: TopologyOptions;
  setOptions: (o: TopologyOptions) => void;
  filters: Filter[];
  setFilters: (v: Filter[]) => void;
  selected: GraphElementPeer | undefined;
  onSelect: (e: GraphElementPeer | undefined) => void;
  searchHandle: SearchHandle | null;
  searchEvent?: SearchEvent;
  isDark?: boolean;
}> = ({
  loading,
  k8sModels,
  error,
  range,
  metricFunction,
  metricType,
  metricScope,
  setMetricScope,
  metrics,
  options,
  setOptions,
  filters,
  setFilters,
  selected,
  onSelect,
  searchHandle,
  searchEvent,
  isDark
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [controller, setController] = React.useState<Visualization>();

  //create controller on startup and register factories
  React.useEffect(() => {
    const c = new Visualization();
    c.registerLayoutFactory(layoutFactory);
    c.registerComponentFactory(componentFactory);
    c.registerComponentFactory(stylesComponentFactory);
    setController(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <LokiError title={t('Unable to get topology')} error={error} />;
  } else if (!controller || (_.isEmpty(metrics) && loading)) {
    return (
      <Bullseye data-test="loading-contents">
        <Spinner size="xl" />
      </Bullseye>
    );
  } else {
    return (
      <VisualizationProvider data-test="visualization-provider" controller={controller}>
        <TopologyContent
          k8sModels={k8sModels}
          range={range}
          metricFunction={metricFunction}
          metricType={metricType}
          metricScope={metricScope}
          setMetricScope={setMetricScope}
          metrics={metrics}
          options={options}
          setOptions={setOptions}
          filters={filters}
          setFilters={setFilters}
          selected={selected}
          onSelect={onSelect}
          searchHandle={searchHandle}
          searchEvent={searchEvent}
          isDark={isDark}
        />
      </VisualizationProvider>
    );
  }
};

export default NetflowTopology;
