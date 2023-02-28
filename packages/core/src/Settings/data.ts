import { TokenType, HierarchyLevel, tokenLength} from "../Structure/Types";

const Short = tokenLength.Short
const Long = tokenLength.Long

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

export let defaultSettingsData: { [k in Exclude<HierarchyLevel, 'root'>]: {[k: string]: [TokenType, tokenLength][]}} = {
  'facet': {
    'high': [['index', Long], ['type', Long], ['name', Long], ['children', Long]],
    'medium': [['type', Long], ['name', Long], ['children', Long]],
    'low': [['type', Short], ['name', Short], ['children', Short]],
  },
  'axis': {
    'high': [['name', Long], ['type', Long], ['data', Long], ['size', Long], ['parent', Long], ['aggregate', Long]],
    'medium': [['name', Long], ['type', Long], ['data', Long]],
    'low': [['name', Short], ['type', Short], ['data', Short]],
  },
  'section': {
    'high': [['data', Long], ['index', Long], ['size', Long], ['parent', Long]],
    'medium': [['data', Long], ['size', Long]],
    'low': [['data', Short], ['size', Short]],
  },
  'datapoint': {
    'high': [['data', Long], ['parent', Long]],
    'medium': [['data', Long]],
    'low': [['data', Short]],
  }
}