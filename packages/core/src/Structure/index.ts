import { Guide, Chart, OlliVisSpec, FacetedChart, Axis, Legend, OlliDatum, OlliDataset } from "../Types";
import { fmtValue } from "../utils";
import { AccessibilityTree, AccessibilityTreeNode, NodeType } from "./Types";

type EncodingFilterValue = string | [number | Date, number | Date];
type GridFilterValue = [EncodingFilterValue, EncodingFilterValue];
type FilterValue = EncodingFilterValue | GridFilterValue;

/**
 * Constructs an {@link AccessibilityTreeNode} based off of a generalized visualization
 * @param olliVisSpec the {@link Chart} or {@link CompositeChart} to transform into a tree
 * @returns The transormed {@link AccessibilityTreeNode}
 */
export function olliVisSpecToTree(olliVisSpec: OlliVisSpec): AccessibilityTree {
    const fieldsUsed = getFieldsUsedForChart(olliVisSpec);
    switch (olliVisSpec.type) {
        case "facetedChart":
            return {
                root: olliVisSpecToNode("multiView", olliVisSpec.data, null, olliVisSpec, fieldsUsed),
                fieldsUsed
            }
        case "chart":
            return {
                root: olliVisSpecToNode("chart", olliVisSpec.data, null, olliVisSpec, fieldsUsed),
                fieldsUsed
            }
        default:
            throw `olliVisSpec.type ${(olliVisSpec as any).type} not handled in olliVisSpecToTree`;
    }
}

function getFieldsUsedForChart(olliVisSpec: OlliVisSpec): string[] {
    switch (olliVisSpec.type) {
        case "facetedChart":
            return [...new Set([olliVisSpec.facetedField, ...[...olliVisSpec.charts.values()].flatMap((chart: Chart) => getFieldsUsedForChart(chart))])];
        case "chart":
            return [...new Set((olliVisSpec.axes as Guide[]).concat(olliVisSpec.legends).reduce((fields: string[], guide: Guide) => fields.concat(guide.field), []))];
        default:
            throw `olliVisSpec.type ${(olliVisSpec as any).type} not handled in getFieldsUsedForChart`;
    }
}

const filterInterval = (selection: OlliDataset, field: string, lowerBound: number | Date, upperBound: number | Date): OlliDataset => {
    return selection.filter((datum: any) => {
        let value = datum[field];
        if (value instanceof Date) {
            const lowerBoundStr = String(lowerBound);
            const upperBoundStr = String(upperBound);
            if (lowerBoundStr.length === 4 && upperBoundStr.length === 4) {
                value = value.getFullYear();
            }
        }
        return value >= lowerBound && value < upperBound;
    })
}

function axisValuesToIntervals(values: string[] | number[]): ([number, number] | [Date, Date])[] {

    const ensureAxisValuesNumeric = (values: any[]): {values: number[], isDate?: boolean} => {
        const isStringArr = values.every(v => typeof v === 'string' || v instanceof String);
        if (isStringArr) {
            return {
                values: values.map(s => Number(s.replaceAll(',', '')))
            };
        }
        const isDateArr = values.every(v => v instanceof Date);
        if (isDateArr) {
            return {
                values: values.map(d => d.getTime()),
                isDate: true
            };
        }
        return {
            values
        };
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
            const finalIncrement = currentValue + incrementDifference;
            incrementArray.push([array[reducedIndex] as number, currentValue])
            bounds = [currentValue, finalIncrement];

        } else {
            bounds = [array[reducedIndex] as number, array[reducedIndex + 1] as number];
        }
        incrementArray.push([bounds[0], bounds[1]])
        return incrementArray
    }

    const res = ensureAxisValuesNumeric(values);
    const increments = res.values.reduce(getEncodingValueIncrements, []);
    if (res.isDate) {
        return increments.map(value => [new Date(value[0]), new Date(value[1])])
    }
    return increments;
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
function olliVisSpecToNode(type: NodeType, selected: any[], parent: AccessibilityTreeNode | null, olliVisSpec: OlliVisSpec, fieldsUsed: string[], facetValue?: string, filterValue?: FilterValue, guide?: Guide, index?: number, length?: number, gridIndex?: {i: number, j: number}): AccessibilityTreeNode {
    let node: AccessibilityTreeNode = {
        type: type,
        parent: parent,
        selected: selected,
        gridIndex,
        //
        description: type,
        children: [],
    }

    const facetedChart = olliVisSpec as FacetedChart;
    const chart = olliVisSpec as Chart;

    switch (type) {
        case "multiView":
            node.children = [...facetedChart.charts.entries()].map(([facetValue, chart]: [string, Chart], index, array) => {
                return olliVisSpecToNode(
                    "chart",
                    selected.filter((datum: any) => String(datum[facetedChart.facetedField]) === facetValue),
                    node,
                    chart,
                    fieldsUsed,
                    facetValue,
                    undefined,
                    undefined,
                    index,
                    array.length
                    );
            });
            break;
        case "chart":
            // remove some axes depending on mark type
            const filteredAxes = chart.axes.filter(axis => {
                if (chart.mark === 'bar' && axis.type === 'continuous') {
                    // don't show continuous axis for bar charts
                    return false;
                }
                return true;
            });
            node.children = [
                ...filteredAxes.map(axis => {
                    return olliVisSpecToNode(
                        axis.axisType === 'x' ? 'xAxis' : 'yAxis',
                        selected,
                        node,
                        chart,
                        fieldsUsed,
                        facetValue,
                        undefined,
                        axis);
                }),
                ...chart.legends.map(legend => {
                    return olliVisSpecToNode(
                        'legend',
                        selected,
                        node,
                        chart,
                        fieldsUsed,
                        facetValue,
                        undefined,
                        legend);
                }),
                ...(chart.mark === 'point' && filteredAxes.length === 2 && filteredAxes.every(axis => axis.type === 'continuous') ? [
                    olliVisSpecToNode('grid', selected, node, chart, fieldsUsed, facetValue)
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
                            selected.filter(d => String(d[axis.field]) === String(value)),
                            node,
                            chart,
                            fieldsUsed,
                            facetValue,
                            String(value),
                            axis);
                    });
                    break;
                case "continuous":
                    const intervals = axisValuesToIntervals(axis.values);
                    node.children = intervals.map(([a, b]) => {
                        return olliVisSpecToNode(
                            'filteredData',
                            filterInterval(selected, axis.field, a, b),
                            node,
                            chart,
                            fieldsUsed,
                            facetValue,
                            [a, b],
                            axis);
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
                            selected.filter(d => String(d[legend.field]) === String(value)),
                            node,
                            chart,
                            fieldsUsed,
                            facetValue,
                            String(value),
                            legend);
                    });
                    break;
                case "continuous":
                    // TODO currently unsupported
                    break;
            }
            break;
        case "grid":
            const xAxis = chart.axes.find(axis => axis.axisType === 'x')!;
            const yAxis = chart.axes.find(axis => axis.axisType === 'y')!;
            const xIntervals = axisValuesToIntervals(xAxis.values);
            const yIntervals = axisValuesToIntervals(yAxis.values);
            const cartesian = (...a: any[][]) => a.reduce((a: any[], b: any[]) => a.flatMap((d: any) => b.map((e: any) => [d, e].flat())));
            node.children = cartesian(xIntervals, yIntervals).map(([x1, x2, y1, y2], index) => {
                return olliVisSpecToNode(
                    'filteredData',
                    filterInterval(
                        filterInterval(selected, xAxis.field, x1, x2),
                        yAxis.field,
                        y1,
                        y2),
                    node,
                    chart,
                    fieldsUsed,
                    facetValue,
                    [[x1, x2], [y1, y2]],
                    undefined, undefined, undefined, {i: Math.floor(index / yIntervals.length), j: index % yIntervals.length});
            });
            break;
        case "filteredData":
            node.children = selected.map((datum, index, array) => {
                return olliVisSpecToNode(
                    'data',
                    [datum],
                    node,
                    chart,
                    fieldsUsed,
                    facetValue,
                    undefined,
                    guide,
                    index,
                    array.length
                )
            })
            break;
        case "data":
            // set the ordering of the fields for rendering to a table
            // put the filter values last, since user already knows the value
            node.tableKeys = fieldsUsed;
            if (guide) {
                node.tableKeys = node.tableKeys.filter(f => f !== guide.field).concat([guide.field]);
            }
            if (facetValue) {
                const facetedField = fieldsUsed[0];
                node.tableKeys = node.tableKeys.filter(f => f !== facetedField).concat([facetedField]);
            }
            break;
        default:
            throw `Node type ${type} not handled in olliVisSpecToNode`;
    }

    node.description = nodeToDesc(node, olliVisSpec, facetValue, filterValue, guide, index, length);

    return node;
}

/**
 *
 * @param node The node whose description is being created
 * @returns A description based on the provided {@link AccessibilityTreeNode}
 */
function nodeToDesc(node: AccessibilityTreeNode, olliVisSpec: OlliVisSpec, facetValue?: string, filterValue?: FilterValue, guide?: Guide, index?: number, length?: number): string {
    return _nodeToDesc(node, olliVisSpec, facetValue, filterValue, guide, index, length).replace(/\s+/g, ' ').trim();

    function _nodeToDesc(node: AccessibilityTreeNode, olliVisSpec: OlliVisSpec, facetValue?: string, filterValue?: FilterValue, guide?: Guide, index?: number, length?: number): string {
        const chartType = (chart: Chart) => {
            if (chart.mark === 'point') {
                if (chart.axes.every(axis => axis.type === 'continuous')) {
                    return 'scatterplot';
                }
                else {
                    return 'dot plot';
                }
            }
            return chart.mark ? `${chart.mark} chart` : '';
        }
        const chartTitle = (chart: OlliVisSpec) => (chart.title || facetValue) ? `titled "${chart.title || facetValue}"` : '';
        const listAxes = (chart: Chart) => chart.axes.length === 1 ? `with axis "${chart.axes[0].title || chart.axes[0].field}"` : `with axes ${chart.axes.map(axis => `"${axis.title || axis.field}"`).join(' and ')}`;
        const guideTitle = (guide: Guide) => `titled "${guide.title || guide.field}"`;
        const axisScaleType = (axis: Axis) => `for a ${axis.scaleType || axis.type} scale`;
        const legendChannel = (legend: Legend) => legend.channel ? `for ${legend.channel}` : '';
        const pluralize = (count: number, noun: string, suffix = 's') => `${count} ${noun}${count !== 1 ? suffix : ''}`;
        const guideValues = (guide: Guide) => guide.type === 'discrete' ?
            (
                guide.values.length === 2 ?
                `with 2 values: "${fmtValue(guide.values[0])}" and "${fmtValue(guide.values[1])}"` :
                `with ${pluralize(guide.values.length, 'value')} starting with "${guide.values[0]}" and ending with "${guide.values[guide.values.length - 1]}"`
            ) :
            `with values from "${fmtValue(guide.values[0])}" to "${fmtValue(guide.values[guide.values.length - 1])}"`;
        const facetValueStr = (facetValue?: string) => facetValue ? `"${facetValue}".` : '';
        const filteredValues = (guideFilterValues?: EncodingFilterValue) => {
            if (!guideFilterValues) return '';
            else if (Array.isArray(guideFilterValues)) {
                return `${guideFilterValues.map(v => fmtValue(v)).join(' to ')}`
            }
            else {
                return `"${fmtValue(guideFilterValues)}"`;
            }
        }
        const filteredValuesGrid = (gridFilterValues?: GridFilterValue) => {
            if (!gridFilterValues) return '';
            return `in ${filteredValues(gridFilterValues[0])} and ${filteredValues(gridFilterValues[1])}`;
        }
        const indexStr = (index?: number, length?: number) => index !== undefined && length !== undefined ? `${index + 1} of ${length}.` : '';
        const datum = (datum: OlliDatum, node: AccessibilityTreeNode) => {
            return node.tableKeys?.map(field => {
                const value = fmtValue(datum[field]);
                return `"${field}": "${value}"`;
            }).join(', ');
        }
        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

        const chart = olliVisSpec as Chart;
        const axis = guide as Axis;
        const legend = guide as Legend;

        const averageValue = (node: AccessibilityTreeNode, axis: Axis) => {
            // console.log(olliVisSpec);
            // console.log(node.selected);
            if (axis.scaleType !== 'quantitative') return '';
            return `The average value is ${
                Math.round(chart.data.reduce((a, b) => a + Number(b[axis.field]), 0)
                    /chart.data.length)}.`;
        }

        switch (node.type) {
            case 'multiView':
                return `A faceted chart ${chartTitle(olliVisSpec)} with ${node.children.length} views.`;
            case 'chart':
                return `${indexStr(index, length)} A ${chartType(chart)} ${chartTitle(chart)} ${listAxes(chart)}.`;
            case 'xAxis':
            case 'yAxis':
                return `${axis.axisType.toUpperCase()}-axis ${guideTitle(axis)} ${axisScaleType(axis)} ${guideValues(axis)}. ${averageValue(node, axis)} ${facetValueStr(facetValue)}`;
            case 'legend':
                return `Legend ${guideTitle(legend)} ${legendChannel(legend)} ${guideValues(axis)}. ${facetValueStr(facetValue)}`;
            case 'grid':
                return `Grid view of ${chartType(chart)}. ${facetValueStr(facetValue)}`
            case 'filteredData':
                if (node.parent?.type === 'grid') {
                    return `${pluralize(node.children.length, 'value')} ${filteredValuesGrid(filterValue as GridFilterValue)}. ${facetValueStr(facetValue)}`;
                }
                else {
                    return `${capitalize(filteredValues(filterValue as EncodingFilterValue))}. ${pluralize(node.children.length, 'value')}. ${facetValueStr(facetValue)}`;
                }
            case 'data':
                // note: the datum description is not used by the table renderer
                return `${indexStr(index, length)} ${datum(node.selected[0], node)}`;
            default:
                throw `Node type ${node.type} not handled in nodeToDesc`;
        }
    }
}