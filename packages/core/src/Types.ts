/**
 * Detailing the different marks that can exist in a chart
 */
 export type OlliMark = "point" | "bar" | "line";

 export type OlliValue = string | number | Date;

 export interface OlliDatum {
     [key: string]: OlliValue;
 }

 export type OlliDataset = OlliDatum[];

 /**
  * Base information that is common to all OlliVisSpecs
  */
 type BaseOlliVisSpec = {
     type: "chart" | "facetedChart",
     data: OlliDataset,
     title?: string,
     description?: string // possible chart description included with the spec
 }

 /**
  * The grammar of graphics information that has to be parsed from a single view visualization.
  */
  export interface Chart extends BaseOlliVisSpec {
     type: "chart",
     axes: Axis[] ,
     legends: Legend[],
     mark?: OlliMark
 }

 /**
  * plots that may have multiple charts contained within a single specification
  */
 export interface FacetedChart extends BaseOlliVisSpec {
     type: "facetedChart",
     charts: Map<string, Chart>, // maps facet value to chart
     facetedField: string,
 }

 export type OlliVisSpec = Chart | FacetedChart;

 export const chart = (fields: Omit<Chart, 'type'>): Chart => {
  return { ...fields, type: "chart" }
}

export const facetedChart = (fields: Omit<FacetedChart, 'type'>): FacetedChart => {
  return { ...fields, type: "facetedChart" }
}

 /**
 * The {@link Guide} is an the information needed for generating various nodes on the Accessibility Tree where
 *   type: discrete (e.g. for nominal, ordinal data) or continuous (e.g. for quantitative, temporal data)
 *   values: array of values (ex: tick values for a continuous axis, category names for a discrete axis)
 *   field: name of the field encoded by the axis
 *   title: human-readable axis title
 */
export type Guide = {
  type: 'discrete' | 'continuous',
  values: string[] | number[],
  field: string,
  title?: string,
}

/**
* Extending the {@link Guide} interface for visualization axes
*/
export interface Axis extends Guide {
  axisType: 'x' | 'y',
  scaleType?: string // e.g. linear, logarithmic, band
}

/**
* Extending the {@link Guide} interface for visualization legends
*/
export interface Legend extends Guide {
  channel?: string // e.g. color, opacity
}

/**
* Interface describing how a visualization adapter should be created
*/
export type VisAdapter<T> = (spec: T) => Promise<OlliVisSpec>;
