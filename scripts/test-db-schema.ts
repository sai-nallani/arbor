
import 'dotenv/config';
import { db } from '@/db';
import { imageContextLinks, fileNodes, chatBlocks } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    // console.log('Testing DB Schema...');

    try {
        // console.log('Querying imageContextLinks...');
        const links = await db.select().from(imageContextLinks).limit(5);
        // console.log('Links:', links);

        // console.log('Querying fileNodes...');
        const nodes = await db.select().from(fileNodes).limit(5);
        // console.log('Nodes:', nodes);

        // console.log('Join query...');
        const joined = await db
            .select({
                url: fileNodes.url,
                name: fileNodes.name,
                mimeType: fileNodes.mimeType,
            })
            .from(imageContextLinks)
            .innerJoin(fileNodes, eq(imageContextLinks.imageNodeId, fileNodes.id))
            .limit(5);
        // console.log('Joined:', joined);

        // console.log('Success!');
    } catch (error) {
        console.error('DB Error:', error);
    }
}

main();
