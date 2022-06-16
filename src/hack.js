export function setObjValueByPath(path, value, schema) {
    const pList = path.split('.');
    const len = pList.length;
    let elem
    for (let i = 0; i < len - 1; i++) {
        elem = pList[i];
        if (!Object.prototype.hasOwnProperty.call(schema, elem)) throw `invalid path '${path}'`;
        schema = schema[elem];
    }
    elem = pList[len - 1];
    if (!Object.prototype.hasOwnProperty.call(schema, elem)) throw `invalid path '${path}'`;
    if (typeof schema[elem] !== typeof value) {
        throw `value mismatch`;
    }
    schema[elem] = value;
}
