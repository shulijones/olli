import { AccessibilityTree, AccessibilityTreeNode, tokenType, TokenType, hierarchyLevel, HierarchyLevel } from "../Structure/Types";
import { Tree } from "../Render/TreeView/Tree";
import { htmlNodeToTree } from "../Render/TreeView";
import { updateVerbosityDescription } from "./index";

export function addMenuCommands(menu: HTMLElement, t: Tree) {
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      // "Close" menu by moving focus back to the user's previous position in the tree
      t.setFocusToItem(t.lastFocusedItem);
    }
  })
}

export function addTreeCommands(treeElt: HTMLElement, tree: AccessibilityTree, t: Tree) {
  let lastTimePressed = new Date().valueOf();

  treeElt.addEventListener('keydown', (event) => {
    const timePressed = new Date().valueOf();
    if (event.ctrlKey && event.key === 'm') {
      // "Open" menu by moving focus there
      const menu = document.getElementById('settings')!;
      menu.focus();
      menu.setAttribute('aria-selected', 'true');

      t.keylog = '';
    }

    // If the first time key pressed in 2 seconds, empty previous keylog
    // TODO try out some timings
    if ((timePressed - lastTimePressed) > 2*1000) {
      t.keylog = '';
    }
    lastTimePressed = timePressed;

    t.keylog += event.key;

    // Check for commands to change a hierarchy level's verbosity setting
    hierarchyLevel.forEach((hLevel: HierarchyLevel) => {
    // for (const hierarchyLevel of ['facet', 'axis', 'section', 'datapoint']) {
      const low = hLevel.slice(0, 1) + 'low';
      const high = hLevel.slice(0, 1) + 'high';
      if (t.keylog.slice(t.keylog.length - low.length) === low) {
        const dropdown = document.getElementById(hLevel + '-verbosity') as HTMLSelectElement;
        dropdown.value = 'low';
        updateVerbosityDescription(dropdown, tree)
        t.keylog = '';
        return;
      } else if (t.keylog.slice(t.keylog.length - high.length) === high) {
        const dropdown = document.getElementById(hLevel + '-verbosity') as HTMLSelectElement;
        dropdown.value = 'high';
        updateVerbosityDescription(dropdown, tree)
        t.keylog = '';
        return;
      }
    });

    // Check for commands to generate an individual description token
    tokenType.forEach((token: TokenType) => {
      const command = "." + token;
      if (t.keylog.slice(t.keylog.length - command.length) === command) {
        const currentNode = document.activeElement! as HTMLElement;
        console.log('curnode is', currentNode);
        const treeNode: AccessibilityTreeNode = htmlNodeToTree(currentNode, tree);
        console.log('curnode desc, token', treeNode.description, token)
        if (treeNode.description.has(token as TokenType)) {
          srSpeakingHack(treeNode.description.get(token as TokenType)!);
          console.log("speaking:", treeNode.description.get(token as TokenType))
        }
        t.keylog = '';
        return;
      }
    });

    function srSpeakingHack(text: string) {
      const elt = document.createElement('div');
      elt.setAttribute('aria-live', 'assertive');
      document.body.appendChild(elt);
      
      window.setTimeout(function () {
        elt.innerText = text;
      }, 100);

      window.setTimeout(function () {
        
        elt.remove();
      }, 1000);
    }
  })
}