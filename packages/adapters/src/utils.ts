import { Scene, Spec, parse, View, SceneItem, SceneContext } from "vega";
import { isNumeric as vlIsNumeric } from "vega-lite";
import { OlliDataset } from "olli";

export async function getVegaScene(spec: Spec): Promise<SceneGroup> {
  const runtime = parse(spec);
  let view = await new View(runtime)
  .renderer('svg')
  .hover()
  .runAsync();

  return (view.scenegraph() as any).root.items[0] as SceneGroup
}

// TODO pending https://github.com/vega/vega/issues/3562
export type SceneGroup = SceneItem & {
  context: SceneContext;
  items: Scene[];
  height: number;
  width: number;
  stroke?: string;
};

export function filterUniqueObjects<T>(arr: T[]): T[] {
  return arr.filter((value, index) => {
    const _value = JSON.stringify(value);
    return index === arr.findIndex(obj => {
      return JSON.stringify(obj) === _value;
    });
  });
}

export function findScenegraphNodes(scenegraphNode: Scene | SceneGroup | SceneItem, passRole: string): any[] {
  let nodes: any[] = [];
  const cancelRoles: string[] = ["cell", "axis-grid"]
  if ((scenegraphNode as any).items === undefined) {
    return nodes;
  }
  (scenegraphNode as any).items.forEach((nestedItem: any) => {
    if (nestedItem.role !== undefined) {
      if (nestedItem.role === passRole && verifyNode(nestedItem, cancelRoles)) {
        nodes.push(nestedItem);
      } else {
        nodes = nodes.concat(findScenegraphNodes(nestedItem, passRole))
      }
    } else {
      nodes = nodes.concat(findScenegraphNodes(nestedItem, passRole))
    }
  })
  return nodes
}

function verifyNode(scenegraphNode: any, cancelRoles: string[]): boolean {
  if (scenegraphNode.role !== undefined && !cancelRoles.some((role: string) => scenegraphNode.role.includes(role))) {
    if (scenegraphNode.items.every((item: any) => verifyNode(item, cancelRoles)) || scenegraphNode.items === undefined) {
      return true
    } else {
      return false
    }
  } else if (scenegraphNode.role === undefined && scenegraphNode.items !== undefined) {
    return scenegraphNode.items.every((item: any) => verifyNode(item, cancelRoles));
  } else if (scenegraphNode.role === undefined && scenegraphNode.items === undefined) {
    return true
  } else {
    return false
  }
}

export function getData(scene: SceneGroup): OlliDataset {
  try {
    const datasets = (scene as any).context.data;
    const names = Object.keys(datasets).filter(name => {
      return name.match(/(source)|(data)_\d/);
    });
    const name = names.reverse()[0]; // TODO do we know this is the right one?
    const dataset = datasets[name].values.value;

    return dataset;
  } catch (error) {
    throw new Error(`No data found in the Vega scenegraph \n ${error}`)
  }
}

export const guideTypeFromScale = (scaleType: string): 'discrete' | 'continuous' => {
  switch (scaleType) {
    case 'linear':
    case 'log':
    case 'pow':
    case 'sqrt':
    case 'symlog':
    case 'time':
    case 'utc':
    case 'sequential':
    return 'continuous';
    case 'ordinal':
    case 'band':
    case 'point':
    case 'quantile':
    case 'quantize':
    case 'threshold':
    case 'bin-ordinal':
    default:
    return 'discrete';
  }
}

export const guideTypeFromVLEncoding = (encodingType: string): 'discrete' | 'continuous' => {
  switch (encodingType) {
    case 'quantitative':
    case 'temporal':
    return 'continuous';
    case 'ordinal':
    case 'nominal':
    default:
    return 'discrete';
  }
}

export function isNumeric(value: string): boolean {
  return vlIsNumeric(value.replaceAll(',', ''));
}