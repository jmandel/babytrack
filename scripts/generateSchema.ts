import * as fs from 'fs';
import * as path from 'path';

export function generateSchema() {
    const schemaFile = path.join(process.cwd(), 'src/types/newbornTracker.ts');
    const schemaContent = fs.readFileSync(schemaFile, 'utf-8');
    
    const outputDir = path.join(process.cwd(), 'src/generated');
    fs.mkdirSync(outputDir, { recursive: true });
    
    const outputContent = `export const schema = ${JSON.stringify(schemaContent)};`;
    
    fs.writeFileSync(path.join(outputDir, 'schema.ts'), outputContent);
    console.log('Schema exported successfully!');
}

generateSchema(); 