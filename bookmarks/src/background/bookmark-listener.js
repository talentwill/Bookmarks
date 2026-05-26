export function flattenBookmarks(tree) {
  const result = [];

  function walk(nodes) {
    for (const node of nodes) {
      if (node.url) {
        result.push({
          id: node.id,
          title: node.title,
          url: node.url,
          dateAdded: node.dateAdded,
          parentId: node.parentId,
        });
      }
      if (node.children) {
        walk(node.children);
      }
    }
  }

  walk(tree);
  return result;
}
