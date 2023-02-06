import { TopLevelSpec, compile } from "vega-lite";
import {
    VisAdapter,
    OlliVisSpec,
    Chart,
    Axis,
    Legend,
    facetedChart,
    chart,
    OlliDataset
} from "olli";
import { filterUniqueObjects, findScenegraphNodes, getData, getVegaScene, guideTypeFromScale, guideTypeFromVLEncoding, isNumeric, SceneGroup } from "./utils";

/**
 * Adapter to deconstruct Vega-Lite visualizations into an {@link OlliVisSpec}
 * @param spec The Vega-Lite Spec that rendered the visualization
 * @returns An {@link OlliVisSpec} of the deconstructed Vega-Lite visualization
 */
export const VegaLiteAdapter: VisAdapter<TopLevelSpec> = async (spec: TopLevelSpec): Promise<OlliVisSpec> => {
    const scene: SceneGroup = await getVegaScene(compile(spec).spec);
    const data = getData(scene);
    const description = spec.description; // possible text description included with spec
    if (scene.items.some((node: any) => node.role === 'scope')) {
        // looking for role === 'scope' means we're using parseMultiView to handle
        // both faceted charts and multi-series lines
        return {description, ...parseMultiView(spec, scene, data)}
    } else {
        return {description, ...parseChart(spec, scene, data)}
    }
}

/**
 * @param scenegraph The Vega Scenegraph from the view
 * @param spec The Vega-Lite Spec that rendered the visualization
 * @returns An {@link OlliVisSpec} of the deconstructed Vega-Lite visualization
 */
function parseMultiView(spec: TopLevelSpec, scene: SceneGroup, data: OlliDataset): OlliVisSpec {
    const axes = filterUniqueObjects<Axis>(findScenegraphNodes(scene, "axis").map((axis: any) => parseAxis(axis, spec, data)));
    const legends = filterUniqueObjects<Legend>(findScenegraphNodes(scene, "legend").map((legend: any) => parseLegend(legend, spec)));
    const getFacetedField = (spec: any) => {
        if (spec.encoding?.facet?.field) {
            return spec.encoding?.facet?.field;
        }
        if (spec.encoding?.color?.field) {
            return spec.encoding?.color?.field;
        }
        if (spec.encoding?.color?.condition?.field) {
            return spec.encoding?.color?.condition?.field;
        }
    }
    const facetedField = getFacetedField(spec);
    let nestedHeirarchies: Map<any, Chart> = new Map(scene.items.filter((el: any) => el.role === "scope")[0].items
        .map((chart: any) => {
            const chartData = parseChart(spec, chart, data)
            chartData.axes = axes;
            chartData.legends = legends;
            return [chart.datum[facetedField], chartData]
        })
    );

    let node = facetedChart({
        data,
        charts: nestedHeirarchies,
        facetedField
    })

    return node;
}

/**
 * @param scene The Vega Scenegraph from the view
 * @param spec The Vega-Lite Spec that rendered the visualization
 * @returns An {@link OlliVisSpec} of the deconstructed Vega-Lite visualization
 */
function parseChart(spec: any, scene: SceneGroup, data: OlliDataset): Chart {
    let axes: Axis[] = findScenegraphNodes(scene, "axis").map((axis: any) => parseAxis(axis, spec, data))
    let legends: Legend[] = findScenegraphNodes(scene, "legend").map((legend: any) => parseLegend(legend, spec))
    let mark: any = spec.mark // TODO vega-lite mark type exceeds olli mark type, should do some validation
    if (mark && mark.type) {
        // e.g. "mark": {"type": "line", "point": true}
        mark = mark.type
    }
    let node = chart({
        axes: axes.filter((axis: Axis) => axis.field !== undefined),
        legends: legends,
        data,
        mark
    })
    return node
}

/**
 *
 * @param scene The Vega Scenegraph from the view
 * @param axisScenegraphNode The specific scenegraph node of an axis
 * @param spec The Vega-Lite Spec that rendered the visualization
 * @returns A {@link Axis} from the converted axisScenegraphNode
 */
function parseAxis(axisScenegraphNode: any, spec: any, data: OlliDataset): Axis {
    const axisView = axisScenegraphNode.items[0]
    const orient = axisView.orient
    const encodingKey = orient === 'bottom' ? 'x' : 'y';
    const encoding = spec.encoding[encodingKey];
    const ticks = axisView.items.find((n: any) => n.role === 'axis-tick').items.map((n: any) => n.datum.value);
    const axisType = axisView.orient === "bottom" || axisView.orient === "top" ? "x" : "y";
    let field: string;

    if (encoding.aggregate) {
        // field = Object.keys(data[0]).find((key: string) => key.includes(encoding.field))
        field = `${encoding.aggregate}_${encoding.field}`;
    } else {
        field = encoding.field;
    }

    const scaleType = encoding.type;
    const type = scaleType ? guideTypeFromVLEncoding(scaleType) : (encoding.aggregate ? 'continuous' : 'discrete');

    // convert temporal values into date objects
    if (scaleType === 'temporal') {
        data.forEach(datum => {
            datum[field] = new Date(datum[field]);
        });
    }

    return {
        type,
        values: ticks,
        title: encoding.title || undefined,
        field: field,
        scaleType,
        axisType: axisType
    }
}

/**
 *
 * @param scenegraph The Vega Scenegraph from the view
 * @param legendScenegraphNode The specific scenegraph node of a legend
 * @param spec The Vega-Lite Spec that rendered the visualization
 * @returns A {@link legend} from the converted legendScenegraphNode
 */
function parseLegend(legendScenegraphNode: any, spec: any): Legend {
    const labels: any[] = legendScenegraphNode.items[0].items.find((n: any) => n.role === "legend-entry").items[0].items[0].items;

    const values = labels.map((n: any) => n.items.find((el: any) => el.role === "legend-label").items[0].datum.value);

    const encType = spec.encoding['color'].type;

    const type = encType ? guideTypeFromVLEncoding(encType) :
        (values.every((t: any) => isNumeric(String(t))) ? 'continuous' : 'discrete');

    // TODO legend channel currently hardcoded to color
    return {
        type,
        values,
        title: spec.encoding['color'].title ? spec.encoding['color'].title : spec.encoding['color'].field,
        field: spec.encoding['color'].field,
        channel: 'color'
    }
}
