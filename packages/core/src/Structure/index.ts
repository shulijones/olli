import { Guide, Chart, OlliVisSpec, OlliMark, FacetedChart, chart, Axis, Legend } from "olli-adapters/src/Types";
import { AccessibilityTree, AccessibilityTreeNode, NodeType } from "./Types";

/**
 * Constructs an {@link AccessibilityTreeNode} based off of a generalized visualization
 * @param olliVisSpec the {@link Chart} or {@link CompositeChart} to transform into a tree
 * @returns The transormed {@link AccessibilityTreeNode}
 */
export function olliVisSpecToTree(olliVisSpec: OlliVisSpec): AccessibilityTree {
    switch (olliVisSpec.type) {
        case "facetedChart":
            return {
                root: olliVisSpecToNode("multiView", olliVisSpec.data, null, olliVisSpec),
                fieldsUsed: getFieldsUsedForChart(olliVisSpec)
            }
        case "chart":
            return {
                root: olliVisSpecToNode("chart", olliVisSpec.data, null, olliVisSpec),
                fieldsUsed: getFieldsUsedForChart(olliVisSpec)
            }
        default:
            throw `olliVisSpec.type ${(olliVisSpec as any).type} not handled in olliVisSpecToTree`;
    }
}

function getFieldsUsedForChart(olliVisSpec: OlliVisSpec): string[] {
    switch (olliVisSpec.type) {
        case "facetedChart":
            return [olliVisSpec.facetedField, ...[...olliVisSpec.charts.values()].flatMap((chart: Chart) => getFieldsUsedForChart(chart))];
        case "chart":
            return (olliVisSpec.axes as Guide[]).concat(olliVisSpec.legends).reduce((fields: string[], guide: Guide) => fields.concat(guide.field), []);
        default:
            throw `olliVisSpec.type ${(olliVisSpec as any).type} not handled in olliVisSpecToTree`;
    }
}

const filterInterval = (selection: any[], field: string, lowerBound: number, upperBound: number): any[] => {
    return selection.filter((val: any) => {
        // TODO: commented out date handling and value not found thingy
        // if ((lowerCaseDesc.includes("date") || lowerCaseDesc.includes("temporal")) && upperBound.toString().length === 4) {
        //     const d = new Date(val[field])
        //     return d.getFullYear() >= lowerBound && d.getFullYear() < upperBound;
        // } else if (val[field] === undefined) {
        //     let updatedField = Object.keys(val).find((k: string) => k.includes(field) || field.includes(k))
        //     if (updatedField) return val[updatedField] >= lowerBound && val[updatedField] < upperBound;
        // }
        return val[field] >= lowerBound && val[field] < upperBound;
    })
}

function axisValuesToIntervals(values: string[] | number[]): [number, number][] {

    const ensureAxisValuesNumeric = (values: any[]): number[] => {
        const isStringArr = values.every(v => typeof v === 'string' || v instanceof String);
        if (isStringArr) {
            return values.map(s => parseFloat(s.replaceAll(',', '')));
        }
        return values;
    }

    const getEncodingValueIncrements = (incrementArray: [number, number][], currentValue: number, index: number, array: number[]): [number, number][] => {
        let bounds: [number, number]
        let reducedIndex = index - 1;
        if (index === 0 && currentValue === 0) {
            return incrementArray
        } else if (reducedIndex === -1 && currentValue !== 0) {
            const incrementDifference: number = (array[index + 1] as number) - currentValue
            bounds = [(currentValue - incrementDifference), currentValue];
        } else if (index === array.length - 1) {
            const incrementDifference: number = currentValue - (array[index - 1] as number)
            let finalIncrement;
            // TODO i commented out date handling. it will require changes to typings
            // if (currentValue instanceof Date) {
                // finalIncrement = currentValue.getTime() + incrementDifference;
            // } else {
                finalIncrement = currentValue + incrementDifference;
            // }
            incrementArray.push([array[reducedIndex] as number, currentValue])
            bounds = [currentValue, finalIncrement];

        } else {
            bounds = [array[reducedIndex] as number, array[reducedIndex + 1] as number];
        }
        incrementArray.push([bounds[0], bounds[1]])
        return incrementArray
    }

    values = ensureAxisValuesNumeric(values);
    return values.reduce(getEncodingValueIncrements, []);
}

/**
 * Creates a {@link AccessibilityTreeNode} of the given parameters
 * @param desc The string that will be used when rendering this node
 * @param parent The parent {@link AccessibilityTreeNode} of the node to be generated
 * @param selected Selection of data from this node and its children
 * @param type Meta-data to know what kind of element this node is from a visualization
 * @param childrenInformation changing variable to assist with generating more nodes of the tree
 * @returns The {@link AccessibilityTreeNode} from the provided parameters
 */
function olliVisSpecToNode(type: NodeType, selected: any[], parent: AccessibilityTreeNode | null, olliVisSpec: OlliVisSpec, guide?: Guide): AccessibilityTreeNode {
    let node: AccessibilityTreeNode = {
        type: type,
        parent: parent,
        selected: selected,
        //
        description: nodeToDesc(type, selected, parent, olliVisSpec),
        children: [],
    }

    const facetedChart = olliVisSpec as FacetedChart;
    const chart = olliVisSpec as Chart;

    switch (type) {
        case "multiView":
            node.children = [...facetedChart.charts.entries()].map(([facetValue, chart]: [string, Chart]) => {
                return olliVisSpecToNode(
                    "chart",
                    selected.filter((datum: any) => datum[facetedChart.facetedField] === facetValue),
                    node,
                    chart);
            });
            break;
        case "chart":
            // remove some axes depending on mark type
            chart.axes = chart.axes.filter(axis => {
                if (chart.mark === 'bar' && axis.type === 'continuous') {
                    // don't show continuous axis for bar charts
                    return false;
                }
                return true;
            });
            node.children = [
                ...chart.axes.map(axis => {
                    return olliVisSpecToNode(
                        axis.axisType === 'x' ? 'xAxis' : 'yAxis',
                        selected,
                        node,
                        chart,
                        axis);
                }),
                ...chart.legends.map(legend => {
                    return olliVisSpecToNode(
                        'legend',
                        selected,
                        node,
                        chart,
                        legend);
                }),
                ...(chart.mark === 'point' && chart.axes.length === 2 ? [
                    olliVisSpecToNode('grid', selected, node, chart)
                ] : [])
            ]
            break;
        case "xAxis":
        case "yAxis":
            const axis = guide as Axis;
            switch (axis.type) {
                case "discrete":
                    node.children = axis.values.map(value => {
                        return olliVisSpecToNode(
                            'filteredData',
                            selected.filter(d => d[axis.field] === value),
                            node,
                            chart);
                    });
                    break;
                case "continuous":
                    const intervals = axisValuesToIntervals(axis.values);
                    node.children = intervals.map(([a, b]) => {
                        return olliVisSpecToNode(
                            'filteredData',
                            filterInterval(selected, axis.field, a, b),
                            node,
                            chart);
                    });
                    break;
            }
            break;
        case "legend":
            const legend = guide as Legend;
            switch (legend.type) {
                case "discrete":
                    node.children = legend.values.map(value => {
                        return olliVisSpecToNode(
                            'filteredData',
                            selected.filter(d => d[legend.field] === value),
                            node,
                            chart);
                    });
                    break;
                case "continuous":
                    // TODO currently unsupported
                    break;
            }
            break;
        case "grid":
            const xAxis = chart.axes.find(axis => axis.axisType === 'x')!;
            const xIntervals = axisValuesToIntervals(xAxis.values);
            const yAxis = chart.axes.find(axis => axis.axisType === 'y')!;
            const yIntervals = axisValuesToIntervals(yAxis.values);
            const cartesian = (...a: any[][]) => a.reduce((a: any[], b: any[]) => a.flatMap((d: any) => b.map((e: any) => [d, e].flat())));
            node.children = cartesian(xIntervals, yIntervals).map(([x1, x2, y1, y2]) => {
                return olliVisSpecToNode(
                    'filteredData',
                    filterInterval(
                        filterInterval(selected, xAxis.field, x1, x2),
                        yAxis.field,
                        y1,
                        y2),
                    node,
                    chart);
            });
            break;
        case "filteredData":
            node.children = selected.map(datum => {
                return olliVisSpecToNode(
                    'data',
                    [datum],
                    node,
                    chart
                )
            })
            break;
        case "data":
            // pass; no children to generate
            break;
        default:
            throw `Node type ${type} not handled in olliVisSpecToNode`;
    }

    return node;
}

/**
 *
 * @param node The node whose description is being created
 * @returns A description based on the provided {@link AccessibilityTreeNode}
 */
function nodeToDesc(type: NodeType, selected: any[], parent: AccessibilityTreeNode | null, olliVisSpec: OlliVisSpec, guide?: Guide): string {
    // if (node.type === "multiView" || node.type === "chart") {
    //     return node.description
    // } else if (node.type === "xAxis" || node.type === "yAxis") {
    //     return node.description
    // } else if (node.type === `legend`) {
    //     return node.description
    // } else if (node.type === "filteredData") {
    //     return `Range ${node.description} ${node.selected.length} ${node.selected.length === 1 ? 'value' : 'values'} in the interval`
    // } else if (node.type === `grid`) {
    //     return node.description
    // } else if (node.type === 'data') {
    //     return node.fieldsUsed.reduce((desc: string, currentKey: string) => `${desc} ${currentKey}: ${node.selected[0][currentKey]}`, "");
    // }
    return type;
}
