import { VisAdapter, OlliVisSpec, FacetedChart, Chart, Axis, Legend, OlliMark } from "olli";
import { guideTypeFromScale, isNumeric } from "./utils";
// Observable-Plot has no type declaration file :/
const Plot = require("@observablehq/plot")

/**
 * Observable-Plot does not have any exported types
 */
type ObservablePlotSpec = any;

/**
 * * Adapter to deconstruct ObservablePlot visualizations into an {@link OlliVisSpec}
 * @param plot The ObservablePlot spec to render the visualization
 * @returns the generated {@link OlliVisSpec}
 */
export const ObservablePlotAdapter: VisAdapter<ObservablePlotSpec> = async (plotObject: ObservablePlotSpec): Promise<OlliVisSpec> => {
    const plotSVG = await Plot.plot(plotObject)
    const description = plotObject.ariaDescription;
    if (hasFacets(plotObject) || isMultiSeries(plotObject)) {
        return {description, ...plotToFacetedChart(plotObject, plotSVG)};
    } else {
        return {description, ...plotToChart(plotObject, plotSVG)};
    }
}

/**
 * Specifies that the provided visualization information relates to a faceted chart
 * @param plot The ObservablePlot spec to render the visualization
 * @param svg the rendered SVGElement of the visualization
 * @returns the generated {@link FacetedChart}
 */
function plotToFacetedChart(plot: any, svg: Element): FacetedChart {
    const chartSVG = svg.tagName !== 'svg' ? Object.values(svg.children).find((n) => n.tagName === 'svg')! : svg;
    // const axes: Axis[] = ['x-axis', 'y-axis'].reduce((parsedAxes: Axis[], s: string) => {
    //     let axisSVG = findHtmlElement(chartSVG, s);
    //     if (axisSVG) {
    //         parsedAxes.push(parseAxis(plot, axisSVG))
    //     }
    //     return parsedAxes
    // }, [])
    let legends: Legend[] = []
    if (plot.color && plot.color.legend) legends.push(parseLegend(plot, svg.children[0]))
    const plotMark = plot.marks.filter((mark: any) => mark.ariaLabel !== 'rule')[0]
    let charts: Map<any, Chart> = new Map();
    let facetField = plot.facet ?
        plot.facet.y ?
            plot.facet.y :
            plot.facet.x :
        flatChannels(plot.marks.find((mark: any) => mark.ariaLabel === 'line').channels).find((c: any) => c.name === "stroke").value;
    if (hasFacets(plot)) {
        charts = new Map(Object.values(chartSVG.children)
            .filter((n) => n.getAttribute('aria-label') === 'facet')
            .map((n: any) => [n.__data__, plotToChart(plot, chartSVG)]));
    } else {
        const strokeValues = plotMark.data.reduce((values: string[], d: any) => {
            if (!values.includes(d[facetField])) {
                values.push(d[facetField]);
            }
            return values
        }, [])
        charts = new Map(strokeValues.map((s: string) => [s, plotToChart(plot, chartSVG)]))
    }

    charts.forEach((c: Chart) => c.legends = JSON.parse(JSON.stringify(legends)))

    let facetedChart: FacetedChart = {
        type: "facetedChart",
        charts: charts,
        data: plotMark.data,
        facetedField: facetField,
    };

    return facetedChart
}

/**
 * Specifies that the provided visualization information relates to a single chart
 * @param plot The ObservablePlot spec to render the visualization
 * @param svg the rendered Element of the visualization
 * @param data A filtered data set used in the chart
 * @returns the generated {@link Chart}
 */
function plotToChart(plot: any, svg: Element): Chart {
    const axes: Axis[] = ['x-axis', 'y-axis'].reduce((parsedAxes: Axis[], s: string) => {
        const chartSVG = svg.tagName !== 'svg' ? Object.values(svg.children).find((n) => n.tagName === 'svg')! : svg;
        let axisSVG = findHtmlElement(chartSVG, s);
        if (axisSVG) {
            parsedAxes.push(parseAxis(plot, axisSVG))
        }
        return parsedAxes
    }, [])
    let legends: Legend[] = []
    if (plot.color && plot.color.legend) legends.push(parseLegend(plot, svg.children[0]))
    const plotMark = plot.marks.filter((mark: any) => mark.ariaLabel !== 'rule')[0]

    const chart: Chart = {
        axes: axes,
        type: "chart",
        mark: plotMarkToOlliMark(plotMark.ariaLabel),
        legends: legends,
        data: plotMark.data
    }

    return chart
}

/**
 * Creates an {@link Axis} from the provided spec and svg
 * @param plot The ObservablePlot spec to render the visualization
 * @param svg the SVG element of an axis
 * @returns A {@link Axis} of the visualization
 */
function parseAxis(plot: any, svg: Element): Axis {
    const axisType = svg?.getAttribute('aria-label') === 'y-axis' ? 'y' : 'x'
    const plotMark = plot.marks.filter((mark: any) => mark.ariaLabel !== 'rule')[0]
    const channel = flatChannels(plotMark.channels).find((c: any) => c.scale === axisType)
    const field: string = typeof channel.value === 'object' ? channel.value.label : channel.value
    const ticks: string[] = Object.keys(svg.children).map((k: string) => {
        const cObj: Element = svg.children[parseInt(k)]
        let tickValue: string = '';
        if (cObj.classList[0] === 'tick') {
            cObj.childNodes.forEach((innerChild: ChildNode) => {
                if (innerChild.textContent !== '') {
                    tickValue = innerChild.textContent!
                }
            })
        }

        return tickValue;
    }).filter(t => t.length);

    const type = ticks.every(t => isNumeric(t)) ? 'continuous' : 'discrete';

    let guide: Axis = {
        type,
        values: type === 'discrete' ? ticks : ticks.map(t => Number(t.replace(/,/g, ''))),
        field: field,
        axisType: axisType
    }

    if (channel.type) {
        guide.scaleType = channel.type
    }

    return guide
}

/**
 * Creates an {@link Legend} from the provided spec and svg
 * @param plot The ObservablePlot spec to render the visualization
 * @param svg the SVG element of an legend
 * @returns A {@link Legend} of the visualization
 */
function parseLegend(plot: any, svg: Element): Legend { //TODO: Does not support 'ramp' legend types when the legend is rendered as an SVG
    const plotMark = plot.marks.filter((mark: any) => mark.ariaLabel !== 'rule')[0];
    const channel = flatChannels(plotMark.channels).find((c: any) => c.scale === 'color'); // TODO channel hardcoded to color
    const values: string[] = Object.keys(svg.children).map((k: string) => {
        let c = svg.children[parseInt(k)];
        if (c.nodeName !== 'STYLE') {
            return c.textContent!;
        }
        return '';
    }).filter(x => x.length);
    const field: string = typeof channel.value === 'object' ? channel.value.label : channel.value
    const scaleType = plot?.color?.type;

    const type = scaleType ? guideTypeFromScale(scaleType) :
        (values.every(v => isNumeric(v)) ? 'continuous' : 'discrete');

    let guide: Legend = {
        type,
        values: type === 'discrete' ? values : values.map(v => Number(v.replace(/,/g, ''))),
        field: field,
        channel: 'color', // TODO
    }

    return guide
}

/**
 * Finds a specified HTML element from a provided string
 * @param svg the root HTML Element to begin the search
 * @param label the string of the HTML element to search for
 * @returns the found HTML Element or undefined if no element was found
 */
function findHtmlElement(svg: Element, label: string): Element | undefined {
    const attributeToCompare = 'aria-label';
    let returnedElement: Element | undefined;
    Object.keys(svg.children).forEach((k: string) => {
        let childElement: Element = svg.children[parseInt(k)];
        if (childElement.getAttribute(attributeToCompare) === label) {
            returnedElement = childElement;
        }
    })
    return returnedElement;
}


/**
 * Determines if the provided ObservablePlot object is a faceted chart.
 * @param plot The spec to check
 * @returns True if any facets exist and false otherwise
 */
function hasFacets(plot: any): boolean {
    return plot.facet
}

/**
 * Determines if the provided ObservablePlot object is a multi-series line chart.
 * @param plot The spec to check
 * @returns True if multiple lines exist and false otherwise
 */
function isMultiSeries(plot: any): boolean {
    const lineMarks = plot.marks.find((mark: any) => mark.ariaLabel === 'line');
    return lineMarks && flatChannels(lineMarks.channels).some((c: any) => c.name === "stroke");
}

function plotMarkToOlliMark(m: string): OlliMark | undefined {
    switch (m) {
        case ('dot'):
            return "point";
        case ('bar'):
            return "bar";
        case ('line'):
            return "line";
        default:
            return undefined
    }
}

function flatChannels(channels: any) {
    return channels.find ? channels : Object.entries(channels).map(([name, chan]) => ({...chan as {}, name}))
}