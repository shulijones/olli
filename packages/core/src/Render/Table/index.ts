import { OlliDatum } from "olli-adapters/src/Types";
import { AccessibilityTreeNode } from "../../Structure/Types";

/**
 *
 * @param tree The {@link AccessibilityTreeNode} to generate a table from
 * @returns An {@link HTMLElement} table of the data used in a visualization
 */
export function renderTable(tree: AccessibilityTreeNode, fieldsUsed: string[]): HTMLElement {
    const table = document.createElement("table");
    const tableBody = document.createElement("tbody");
    const tableHeaders = document.createElement("tr");
    fieldsUsed.forEach((field: string) => {
        const header = document.createElement("th");
        header.innerText = field;
        tableHeaders.appendChild(header);
    })

    tableBody.appendChild(tableHeaders)
    tree.selected.forEach((data: OlliDatum) => {
        const dataRow = document.createElement("tr")
        fieldsUsed.forEach((field: string) => {
            const tableData = document.createElement("td")
            tableData.innerText = String(data[field]);
            dataRow.appendChild(tableData);
        })

        tableBody.appendChild(dataRow);
    })
    table.appendChild(tableBody)

    return table
}