import asyncio
from dedalus_labs import AsyncDedalus, DedalusRunner
from dotenv import load_dotenv

load_dotenv()

async def main():
    client = AsyncDedalus()
    runner = DedalusRunner(client)

    result = await runner.run(
        input="Who is Sai Nallani?",
        model="anthropic/claude-opus-4-5",
        mcp_servers=["joerup/exa-mcp"]
    )

    print(result.final_output)

if __name__ == "__main__":
    asyncio.run(main())