const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { Web3 } = require('web3');

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" }); // Replace with your region

const erc20ABI = [
    {
        "constant": true,
        "inputs": [
            {
                "name": "_owner",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "name": "balance",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    }
];

exports.handler = async (event) => {
    try {
        // Connecting to Ethereum Node (use appropriate provider)
        const web3 = new Web3('https://light-snowy-hexagon.bsc.discover.quiknode.pro/a09d33e13b135e3aa00d8d3781cfc608bc33650e');

        // Replace with the actual blockchains you are interested in
        const blockchains = ['BNBSmartChain'];

        for (const blockchain of blockchains) {
            const params = {
                TableName: "blockchain-balance",
                KeyConditionExpression: "#bc = :blockchain",
                FilterExpression: "#balance > :minBalance", // Filtering items with Balance > 100
                ExpressionAttributeNames: {
                    "#bc": "Blockchain",
                    "#balance": "Balance",
                },
                ExpressionAttributeValues: {
                    ":blockchain": { S: blockchain },
                    ":minBalance": { N: "100" } // Assuming the 'Balance' attribute is of type Number
                },
            };

            const data = await dynamoDBClient.send(new QueryCommand(params));

            if (!data.Items || data.Items.length === 0) continue;

            const maxQueries = 3; // Limiting the number of queries to 3
            let queryCount = 0; // To keep track of how many items have been processed

            const tokenAddress = "0xb700597d8425ced17677bc68042d7d92764acf59";

            for (const item of data.Items) {
                if (queryCount++ >= maxQueries) break; // Break out of the loop after processing 3 items

                const walletAddress = item.Address.S; // Replace with actual attribute name

                // Constructing contract instance to interact with ERC-20 Token
                const contract = new web3.eth.Contract(erc20ABI, tokenAddress);
                
                const balance = await contract.methods.balanceOf(walletAddress).call();
                console.log(`Blockchain: ${blockchain}, Token Address: ${tokenAddress}, Wallet Address: ${walletAddress}, Balance: ${balance}`);
            }
        }

        return { statusCode: 200, body: JSON.stringify('Function executed successfully!') };
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify('Internal Server Error') };
    }
};
