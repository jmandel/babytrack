import * as fs from 'fs';
import * as path from 'path';
import { generateSchema } from './generateSchema';

const schemaFile = path.join(process.cwd(), 'src/types/newbornTracker.ts');

console.log('Watching for schema changes...');
generateSchema(); // Initial generation

fs.watch(schemaFile, (eventType) => {
    if (eventType === 'change') {
        console.log('Schema file changed, regenerating...');
        generateSchema();
    }
}); 