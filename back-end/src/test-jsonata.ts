import jsonata from 'jsonata';

console.log('jsonata imported successfully');
try {
    const expr = jsonata('$sum([1, 2, 3])');
    const result = await expr.evaluate({});
    console.log('Result:', result);
} catch (e) {
    console.error(e);
}
