import { AccessibilityTree, AccessibilityTreeNode, tokenType, TokenType, tokenLength, hierarchyLevel, HierarchyLevel, nodeTypeToHierarchyLevel } from "../Structure/Types";
import { Tree } from "../Render/TreeView/Tree";
import { htmlNodeToTree } from "../Render/TreeView";
import { updateVerbosityDescription, getCurrentCustom, prettifyTokenTuples } from "./index";

export function addMenuCommands(menu: HTMLElement, t: Tree) {
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      // "Close" menu by hiding it and moving focus back to the user's previous position in the tree
      const menu = document.getElementById('settings')!;
      menu.setAttribute('style', 'display: none');
      menu.setAttribute('aria-hidden', 'true');
      t.setFocusToItem(t.lastFocusedItem);
    } else if (event.altKey && event.key === 'ArrowLeft') {
      // Reorder custom preset items
      const thisItem = document.activeElement as HTMLSelectElement;

      if (thisItem && thisItem.nodeName === "SELECT") {
        const thisDiv = thisItem.parentNode! as HTMLElement;
        const previousDiv = thisDiv.previousElementSibling;
        if (previousDiv != null) {
          // Change menu ordering
          // Note: don't want to call insertBefore(thisDiv, previousDiv)
          // because first parameter to insertBefore loses focus
          thisDiv.insertAdjacentElement('afterend', previousDiv);
          thisItem.focus();
          thisItem.setAttribute('aria-active', 'true');

          const hierarchyLevel = thisItem.id.split('-')[0];
          srSpeakingHack(prettifyTokenTuples(getCurrentCustom(hierarchyLevel)));
        }
      }
    } else if (event.altKey && event.key === 'ArrowRight') {
      const thisItem = document.activeElement as HTMLSelectElement;
      if (thisItem && thisItem.nodeName === "SELECT") {
        const thisDiv = thisItem.parentNode! as HTMLElement;
        const nextDiv = thisDiv.nextElementSibling;
        if (nextDiv != null) {
          thisDiv.parentNode!.insertBefore(nextDiv, thisDiv);

          const hierarchyLevel = thisItem.id.split('-')[0];
          srSpeakingHack(prettifyTokenTuples(getCurrentCustom(hierarchyLevel)));
        }
      }
    } 
  });

  // Keep settings menu a closed environment: send tab at the end to the beginning and vice versa
  const first = menu.firstElementChild! as HTMLElement;
  const last = menu.lastElementChild! as HTMLElement;
  first.addEventListener('keydown', (event) => {
    if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      last.focus();
      last.setAttribute('aria-selected', 'true');
    }
  });

  last.addEventListener('keydown', (event) => {
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      first.focus();
      first.setAttribute('aria-selected', 'true');
    }
  });
}

export function addTreeCommands(treeElt: HTMLElement, tree: AccessibilityTree, t: Tree) {
  let lastTimePressed = new Date().valueOf();

  treeElt.addEventListener('keydown', (event) => {
    const timePressed = new Date().valueOf();
    if (event.ctrlKey && event.key === 'm') {
      // "Open" menu by making it visible and moving focus there
      const menu = document.getElementById('settings')!;
      const legend = menu.firstElementChild! as HTMLElement;
      console.log(legend);
      menu.setAttribute('style', 'display: block');
      menu.setAttribute('aria-hidden', 'false');
      legend.focus();
      legend.setAttribute('aria-selected', 'true');
      console.log(document.activeElement);

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
    const settingsData: { [k in Exclude<HierarchyLevel, 'root'>]: {[k: string]: [TokenType, tokenLength][]}} = JSON.parse(localStorage.getItem('settingsData')!);
    hierarchyLevel.forEach((hLevel: HierarchyLevel) => {
      if (hLevel === 'root') { return; }
      const dropdown = document.getElementById(hLevel + '-verbosity') as HTMLSelectElement;
      const settingLevels = Object.keys(settingsData[hLevel as Exclude<HierarchyLevel, 'root'>]);

      for (const sLevel of settingLevels) {
        const command = hLevel.slice(0, 1) + sLevel;
        if (t.keylog.slice(t.keylog.length - command.length) === command) {
          dropdown.value = sLevel;
          updateVerbosityDescription(dropdown, tree)
          t.keylog = '';
          return;
        }
      }
    });

    // Check for commands to generate an individual description token
    tokenType.forEach((token: TokenType) => {
      const command = "." + token;
      if (t.keylog.slice(t.keylog.length - command.length) === command) {
        const currentNode = document.activeElement! as HTMLElement;
        const treeNode: AccessibilityTreeNode = htmlNodeToTree(currentNode, tree);
        if (treeNode.description.has(token as TokenType)) {
          const hLevel = nodeTypeToHierarchyLevel[treeNode.type] as Exclude<HierarchyLevel, 'root'>;
          const verbosity = (document.getElementById(`${hLevel}-verbosity`) as HTMLSelectElement).value;
          const length = settingsData[hLevel][verbosity].find(x => x[0] === token)![1];
          srSpeakingHack(treeNode.description.get(token as TokenType)![length]);
        }
        t.keylog = '';
        return;
      }
    });

  })
}

export function srSpeakingHack(text: string) {
  console.log('speaking', text);
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