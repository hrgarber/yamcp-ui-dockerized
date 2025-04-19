// Namespace
type Namespace = string;
type NamespacedName = `${Namespace}_${string}`;
function isNamespacedName(name: string): name is NamespacedName {
  return name.includes("_");
}
function addNamespace(namespace: Namespace, name: string): NamespacedName {
  return `${namespace}_${name}`;
}
function parseNamespace(namespacedName: NamespacedName) {
  const [namespace, ...name] = namespacedName.split("_");
  return { namespace, name: name.join("_") };
}

export { isNamespacedName, addNamespace, parseNamespace };
export type { Namespace, NamespacedName };
