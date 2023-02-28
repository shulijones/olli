import { OlliVisSpec } from "./Types"
import { renderTable } from "./Render/Table"
import { Tree } from "./Render/TreeView/Tree"
import { renderTree } from "./Render/TreeView"
import { olliVisSpecToTree } from "./Structure"
import { AccessibilityTree } from "./Structure/Types"
import { renderMenu } from "./Settings"
import { addMenuCommands, addTreeCommands } from "./Settings/commands"

export * from './Types';

/**
 * The configuration object outlining how an accessible visualization should be rendered based on a {@link OlliVisSpec}.
 */
export type OlliConfigOptions = {
    renderType?: 'tree' | 'table'
}

/**
 *
 * @param config The {@link OlliConfigOptions} object to specify how an accessible visualization should be generated.
 */
export function olli(olliVisSpec: OlliVisSpec, config?: OlliConfigOptions): HTMLElement {
    const tree: AccessibilityTree = olliVisSpecToTree(olliVisSpec);

    const htmlRendering: HTMLElement = document.createElement("div");

    config = {
        renderType: config?.renderType || 'tree'
    }

    switch (config.renderType) {
        case ("table"):
            htmlRendering.appendChild(renderTable(tree.root.selected, tree.fieldsUsed));
            break;
        case ('tree'):
        default:
            const menu = renderMenu(tree);
            menu.setAttribute('style', 'display: none');
            menu.setAttribute('aria-hidden', 'true');
            htmlRendering.appendChild(menu);

            const ul = renderTree(tree);
            const container = document.createElement('div');
            container.classList.add('olli-vis');
            container.appendChild(ul);
            htmlRendering.appendChild(container);
            const t = new Tree(ul);
            t.init();
            document.addEventListener('keypress', (e) => {
                if (e.key === 't' && !t.currentlyTypingToken()) {
                    t.setFocusToItem(t.rootTreeItem);
                }
            })

            addMenuCommands(menu, t);
            addTreeCommands(ul, tree, t);
            break;
    }

    return htmlRendering;
}
