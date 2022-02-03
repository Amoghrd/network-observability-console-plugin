import { TFunction } from 'i18next';
import _ from 'lodash';
import { Record } from '../api/ipfix';
import { compareIPs } from '../utils/ip';
import { comparePorts } from '../utils/port';
import { compareProtocols } from '../utils/protocol';
import { compareNumbers, compareStrings } from './base-compare';
import { FilterType } from './filters';

export enum ColumnsId {
  timestamp = 'timestamp',
  srcpod = 'SrcPod',
  dstpod = 'DstPod',
  srcnamespace = 'SrcNamespace',
  dstnamespace = 'DstNamespace',
  srcaddr = 'SrcAddr',
  dstaddr = 'DstAddr',
  srcport = 'SrcPort',
  dstport = 'DstPort',
  proto = 'Proto',
  bytes = 'Bytes',
  packets = 'Packets',
  srcwkd = 'SrcWorkload',
  dstwkd = 'DstWorkload',
  srcwkdkind = 'SrcWorkloadKind',
  dstwkdkind = 'DstWorkloadKind',
  srchost = 'SrcHostIP',
  dsthost = 'DstHostIP',
  flowdir = 'FlowDirection'
}

//specific header width - Allowed values are limited, check TableComposable BaseCellProps with definition
export type ColumnWidth = 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 60 | 70 | 80 | 90 | 100;

export interface Column {
  id: ColumnsId;
  group?: string;
  name: string;
  isSelected: boolean;
  filterType: FilterType;
  value: (flow: Record) => string | number;
  sort(a: Record, b: Record, col: Column): number;
  width: ColumnWidth;
}

export type ColumnGroup = {
  title?: string;
  columns: Column[];
};

export const getColumnGroups = (columns: Column[]) => {
  const groups: ColumnGroup[] = [];
  _.each(columns, col => {
    if (col.group && _.last(groups)?.title === col.group) {
      _.last(groups)!.columns.push(col);
    } else {
      groups.push({ title: col.group, columns: [col] });
    }
  });

  return groups;
};

export const getFullColumnName = (col?: Column) => {
  if (col) {
    return !col.group ? col.name : `${col.group} ${col.name}`;
  } else {
    return '';
  }
};

export const getDefaultColumns = (t: TFunction): Column[] => {
  return [
    {
      id: ColumnsId.timestamp,
      name: t('Date & time'),
      isSelected: true,
      filterType: FilterType.NONE,
      value: f => f.timestamp,
      sort: (a, b, col) => compareNumbers(col.value(a) as number, col.value(b) as number),
      width: 20
    },
    {
      id: ColumnsId.srcpod,
      group: t('Source'),
      name: t('Pod'),
      isSelected: true,
      filterType: FilterType.TEXT,
      value: f => f.fields.SrcPod || '',
      sort: (a, b, col) => compareStrings(col.value(a) as string, col.value(b) as string),
      width: 20
    },
    {
      id: ColumnsId.srcwkd,
      group: t('Source'),
      name: t('Workload'),
      isSelected: false,
      filterType: FilterType.TEXT,
      value: f => f.labels.SrcWorkload || '',
      sort: (a, b, col) => compareStrings(col.value(a) as string, col.value(b) as string),
      width: 20
    },
    {
      id: ColumnsId.srcwkdkind,
      name: t('Src kind'),
      isSelected: false,
      filterType: FilterType.TEXT,
      value: f => f.fields.SrcWorkloadKind || '',
      sort: (a, b, col) => compareStrings(col.value(a) as string, col.value(b) as string),
      width: 10
    },
    {
      id: ColumnsId.srcnamespace,
      group: t('Source'),
      name: t('Namespace'),
      isSelected: true,
      filterType: FilterType.TEXT,
      value: f => f.labels.SrcNamespace || '',
      sort: (a, b, col) => compareStrings(col.value(a) as string, col.value(b) as string),
      width: 20
    },
    {
      id: ColumnsId.srcaddr,
      group: t('Source'),
      name: t('Address'),
      isSelected: false,
      filterType: FilterType.ADDRESS,
      value: f => f.fields.SrcAddr,
      sort: (a, b, col) => compareIPs(col.value(a) as string, col.value(b) as string),
      width: 15
    },
    {
      id: ColumnsId.srcport,
      group: t('Source'),
      name: t('Port'),
      isSelected: true,
      filterType: FilterType.PORT,
      value: f => f.fields.SrcPort,
      sort: (a, b, col) => comparePorts(col.value(a) as number, col.value(b) as number),
      width: 10
    },
    {
      id: ColumnsId.srchost,
      group: t('Source'),
      name: t('Host'),
      isSelected: false,
      filterType: FilterType.ADDRESS,
      value: f => f.fields.SrcHostIP || '',
      sort: (a, b, col) => compareIPs(col.value(a) as string, col.value(b) as string),
      width: 15
    },
    {
      id: ColumnsId.dstpod,
      group: t('Destination'),
      name: t('Pod'),
      isSelected: true,
      filterType: FilterType.TEXT,
      value: f => f.fields.DstPod || '',
      sort: (a, b, col) => compareStrings(col.value(a) as string, col.value(b) as string),
      width: 20
    },
    {
      id: ColumnsId.dstwkd,
      group: t('Destination'),
      name: t('Workload'),
      isSelected: false,
      filterType: FilterType.TEXT,
      value: f => f.labels.DstWorkload || '',
      sort: (a, b, col) => compareStrings(col.value(a) as string, col.value(b) as string),
      width: 20
    },
    {
      id: ColumnsId.dstwkdkind,
      name: t('Dst kind'),
      isSelected: false,
      filterType: FilterType.TEXT,
      value: f => f.fields.DstWorkloadKind || '',
      sort: (a, b, col) => compareStrings(col.value(a) as string, col.value(b) as string),
      width: 30
    },
    {
      id: ColumnsId.dstnamespace,
      group: t('Destination'),
      name: t('Namespace'),
      isSelected: true,
      filterType: FilterType.TEXT,
      value: f => f.labels.DstNamespace || '',
      sort: (a, b, col) => compareStrings(col.value(a) as string, col.value(b) as string),
      width: 20
    },
    {
      id: ColumnsId.dstaddr,
      group: t('Destination'),
      name: t('Address'),
      isSelected: false,
      filterType: FilterType.ADDRESS,
      value: f => f.fields.DstAddr,
      sort: (a, b, col) => compareIPs(col.value(a) as string, col.value(b) as string),
      width: 15
    },
    {
      id: ColumnsId.dstport,
      group: t('Destination'),
      name: t('Port'),
      isSelected: true,
      filterType: FilterType.PORT,
      value: f => f.fields.DstPort,
      sort: (a, b, col) => comparePorts(col.value(a) as number, col.value(b) as number),
      width: 10
    },
    {
      id: ColumnsId.dsthost,
      group: t('Destination'),
      name: t('Host'),
      isSelected: false,
      filterType: FilterType.ADDRESS,
      value: f => f.fields.DstHostIP || '',
      sort: (a, b, col) => compareIPs(col.value(a) as string, col.value(b) as string),
      width: 15
    },
    {
      id: ColumnsId.proto,
      name: t('Protocol'),
      isSelected: false,
      filterType: FilterType.PROTOCOL,
      value: f => f.fields.Proto,
      sort: (a, b, col) => compareProtocols(col.value(a) as number, col.value(b) as number),
      width: 15
    },
    {
      id: ColumnsId.flowdir,
      name: t('Direction'),
      isSelected: false,
      // filters are managed via QuickFilters rather than per-column filter search, so set filterType to NONE
      filterType: FilterType.NONE,
      value: f => f.fields.FlowDirection,
      sort: (a, b, col) => compareNumbers(col.value(a) as number, col.value(b) as number),
      width: 15
    },
    {
      id: ColumnsId.bytes,
      name: t('Bytes'),
      isSelected: true,
      filterType: FilterType.NONE,
      value: f => f.fields.Bytes,
      sort: (a, b, col) => compareNumbers(col.value(a) as number, col.value(b) as number),
      width: 10
    },
    {
      id: ColumnsId.packets,
      name: t('Packets'),
      isSelected: true,
      filterType: FilterType.NONE,
      value: f => f.fields.Packets,
      sort: (a, b, col) => compareNumbers(col.value(a) as number, col.value(b) as number),
      width: 10
    }
  ];
};
