import { Dropdown, DropdownItem, DropdownToggle } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { MetricScopeOptions } from '../../model/metrics';
import { getGroupsForScope, isGroupEnabled, TopologyGroupTypes } from '../../model/topology';
import { FlowScope } from '../../model/flow-query';

export const GroupDropdown: React.FC<{
  disabled?: boolean;
  scope: MetricScopeOptions;
  selected: TopologyGroupTypes;
  setGroupType: (v: TopologyGroupTypes) => void;
  id?: string;
  allowedScopes: FlowScope[];
}> = ({ disabled, scope, selected, setGroupType, id, allowedScopes }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [groupDropdownOpen, setGroupDropdownOpen] = React.useState(false);

  const getGroupDisplay = (groupType: TopologyGroupTypes) => {
    switch (groupType) {
      /** Clusters aggregation and groups */
      case TopologyGroupTypes.CLUSTERS:
        return t('Clusters');
      case TopologyGroupTypes.CLUSTERS_HOSTS:
        return t('Clusters + Nodes');
      case TopologyGroupTypes.CLUSTERS_ZONES:
        return t('Clusters + Zones');
      case TopologyGroupTypes.CLUSTERS_NAMESPACES:
        return t('Clusters + Namespaces');
      case TopologyGroupTypes.CLUSTERS_OWNERS:
        return t('Clusters + Owners');
      /** Zones aggregation and groups */
      case TopologyGroupTypes.ZONES:
        return t('Zones');
      case TopologyGroupTypes.ZONES_HOSTS:
        return t('Zones + Nodes');
      case TopologyGroupTypes.ZONES_NAMESPACES:
        return t('Zones + Namespaces');
      case TopologyGroupTypes.ZONES_OWNERS:
        return t('Zones + Owners');
      /** Hosts aggregation and groups */
      case TopologyGroupTypes.HOSTS:
        return t('Nodes');
      case TopologyGroupTypes.HOSTS_NAMESPACES:
        return t('Nodes + Namespaces');
      case TopologyGroupTypes.HOSTS_OWNERS:
        return t('Nodes + Owners');
      /** Namespaces aggregation and groups */
      case TopologyGroupTypes.NAMESPACES:
        return t('Namespaces');
      case TopologyGroupTypes.NAMESPACES_OWNERS:
        return t('Namespaces + Owners');
      /** Owner aggregation */
      case TopologyGroupTypes.OWNERS:
        return t('Owners');
      default:
        return t('None');
    }
  };

  return (
    <Dropdown
      data-test={id}
      id={id}
      toggle={
        <DropdownToggle
          data-test={`${id}-dropdown`}
          id={`${id}-dropdown`}
          isDisabled={disabled}
          onToggle={() => setGroupDropdownOpen(!groupDropdownOpen)}
        >
          {getGroupDisplay(selected)}
        </DropdownToggle>
      }
      isOpen={groupDropdownOpen}
      dropdownItems={getGroupsForScope(scope)
        .filter(g => isGroupEnabled(g, allowedScopes))
        .map(v => (
          <DropdownItem
            data-test={v}
            id={v}
            key={v}
            onClick={() => {
              setGroupDropdownOpen(false);
              setGroupType(v);
            }}
          >
            {getGroupDisplay(v)}
          </DropdownItem>
        ))}
    />
  );
};

export default GroupDropdown;
