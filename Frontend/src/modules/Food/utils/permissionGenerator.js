import { adminSidebarMenu } from './adminSidebarMenu.js';
import { quickAdminSidebarMenu } from './quickAdminSidebarMenu.js';
import { commonAdminSidebarMenu } from './commonAdminSidebarMenu.js';

const ACTION_MAPPING = {
  'dashboard': ["view"],
  'pos': ["view", "create"],
  'food_approval': ["view", "edit"],
  'joining_request': ["view", "edit", "delete"],
  'reviews': ["view", "delete"],
  'complaints': ["view", "edit", "delete"],
  
  'all': ["view", "edit", "delete"],
  'scheduled': ["view", "edit"],
  'pending': ["view", "edit"],
  'accepted': ["view", "edit"],
  'processing': ["view", "edit"],
  'out_for_delivery': ["view", "edit"],
  'delivered': ["view", "edit"],
  'cancelled': ["view", "edit"],
  'restaurant_cancelled': ["view", "edit"],
  'payment_failed': ["view", "edit"],
  'refunded': ["view", "edit"],
  'offline_payments': ["view", "edit"],
  'order_detect_delivery': ["view", "edit"],

  'transactions': ["view"],
  'orders': ["view"], 
  'tax': ["view"],
  'restaurant_report': ["view"],
  'customer_report': ["view"],
  'feedback_experience': ["view", "delete"],

  'broadcast': ["view", "create"],
  'about': ["view", "edit"],
  'terms': ["view", "edit"],
  'privacy': ["view", "edit"],
  'refund': ["view", "edit"],
  'shipping': ["view", "edit"],
  'cancellation': ["view", "edit"],
  
  'app_settings': ["view", "edit"],
  'admin_settings': ["view", "edit"],
  'modules': ["view", "edit"],

  'seller_requests': ["view", "edit"],
  'tracking': ["view"],
  'withdrawals': ["view", "edit"],
  'seller_payments': ["view"],
  'billing': ["view", "edit"],
  'profile': ["view", "edit"],
  'experience_studio': ["view", "edit"],
  'notifications': ["view", "create"],
  'moderation': ["view", "edit", "delete"],
  'processed': ["view", "edit"],
  'returned': ["view", "edit"],
  'locations': ["view"],
};

export function generatePermissionTree(enabledModules = null) {
  const configs = [
    { root: 'food', data: adminSidebarMenu, moduleKey: 'food' },
    { root: 'quick', data: quickAdminSidebarMenu, moduleKey: 'quickCommerce' },
    { root: 'global', data: commonAdminSidebarMenu, moduleKey: null }
  ];

  const tree = [];

  configs.forEach(({ root, data, moduleKey }) => {
    if (enabledModules && moduleKey && enabledModules[moduleKey] === false) return;

    const moduleNode = {
      label: root.charAt(0).toUpperCase() + root.slice(1),
      permissionKey: root,
      children: [],
      allowedActions: []
    };

    let moduleActions = new Set();
    data.forEach(item => {
      const node = processNode(item, root);
      if (node) {
        moduleNode.children.push(node);
        if (node.allowedActions) node.allowedActions.forEach(a => moduleActions.add(a));
      }
    });
    
    moduleNode.allowedActions = Array.from(moduleActions);
    if (moduleNode.children.length > 0) tree.push(moduleNode);
  });

  return tree;
}

function processNode(item, parentKey) {
  if (!item.permissionKey) return null;

  // Role builder should not expose duplicate top-level dashboard toggles.
  // Root module access already represents dashboard visibility for that module.
  /*
  if (
    item.type === 'link' &&
    item.permissionKey === 'dashboard' &&
    (parentKey === 'food' || parentKey === 'quick')
  ) {
    return null;
  }
  */

  const currentKey = `${parentKey}::${item.permissionKey}`;
  
  const node = {
    label: item.label,
    permissionKey: currentKey,
    type: item.type,
    children: [],
    allowedActions: item.allowedActions || []
  };

  let childActions = new Set();
  const processChildren = (childrenArray) => {
    childrenArray.forEach(child => {
      const childNode = processNode(child, currentKey);
      if (childNode) {
        node.children.push(childNode);
        if (childNode.allowedActions) {
          childNode.allowedActions.forEach(a => childActions.add(a));
        }
      }
    });
  };

  if (item.type === 'section' && item.items) {
    processChildren(item.items);
    node.allowedActions = Array.from(childActions);
  } else if (item.type === 'expandable' && item.subItems) {
    processChildren(item.subItems);
    node.allowedActions = Array.from(childActions);
  } else {
    // Leaf node
    const mappedActions = ACTION_MAPPING[item.permissionKey];
    if (item.allowedActions) {
      node.allowedActions = item.allowedActions;
    } else if (mappedActions) {
      node.allowedActions = mappedActions;
    } else if (item.label.toLowerCase().includes('report') || item.permissionKey.includes('report')) {
      node.allowedActions = ["view"];
    } else {
      node.allowedActions = ["view", "create", "edit", "delete"];
    }
  }

  return node;
}
