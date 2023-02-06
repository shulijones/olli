import { TokenType, HierarchyLevel } from "../Structure/Types";

export const tokenDescs = {
  'index': 'Index ("1 of 5")',
  'type': 'Item type ("line", "temporal")',
  'size': 'Size ("10 values")',
  'relative': 'Quartile',
  'data': 'Data values',
  'aggregate': 'Min, max, and average',
  'parent': 'View name',
  'name': 'Item name',
  'children': 'Child names',
}

export let defaultSettingsData: { [k in Exclude<HierarchyLevel, 'root'>]: {[k: string]: TokenType[]}} = {
  'facet': {
    'high': ['index', 'type', 'name', 'children'],
    'low': ['type', 'name', 'children'],
  },
  'axis': {
    'high': ['name', 'type', 'data', 'size', 'parent', 'aggregate'],
    'low': ['name', 'type', 'data'],
  },
  'section': {
    'high': ['data', 'index', 'size', 'parent'],
    'low': ['data', 'size'],
  },
  'datapoint': {
    'high': ['data', 'parent'],
    'low': ['data']
  }
}