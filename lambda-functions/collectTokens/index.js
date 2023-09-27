const { DynamoDBClient, GetItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { Web3 } = require('web3');

const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager({ region: "us-east-1" });
const kms = new AWS.KMS({ region: "us-east-1" });

const bip39 = require('bip39');
const EthereumWallet = require('ethereumjs-wallet');

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" }); // Replace with your region
const web3 = new Web3('https://light-snowy-hexagon.bsc.discover.quiknode.pro/a09d33e13b135e3aa00d8d3781cfc608bc33650e');

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

const hdWalletPathPrefix = "m/44'/60'/0'/0"; // Replace with your actual prefix

function getHDWalletPath(index) {
    if (typeof index !== 'number' || index < 0) {
        throw new Error('Invalid index for HD Wallet Path');
    }

    return `${hdWalletPathPrefix}/${index}`;
}

function loadHDWallet(entropy) {
    try {
        // Convert entropy to a mnemonic (a 12-word backup phrase) for an HD wallet.
        const mnemonic = bip39.entropyToMnemonic(entropy.toString('hex'));
        // Generate HD Wallet from mnemonic
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const wallet = EthereumWallet.hdkey.fromMasterSeed(seed);
        return wallet;
    } catch (error) {
        console.error('Error loading HD Wallet:', error);
        return null;
    }
}

async function getKeyInfo(keyInfoId) {
    try {
        const params = {
            TableName: 'key-info',
            Key: {
                'ID': { S: keyInfoId } // Assuming keyInfoId is of type String
            },
            ProjectionExpression: 'SecretsManagerARN, KMSKeyID', // Fields you want to get
        };

        const command = new GetItemCommand(params);
        const response = await dynamoDBClient.send(command);

        if (!response.Item) {
            throw new Error(`No item found for keyInfoId: ${keyInfoId}`);
        }

        // Converting DynamoDB AttributeValue to JavaScript types
        return {
            SecretsManagerARN: response.Item.SecretsManagerARN.S,
            KMSKeyID: response.Item.KMSKeyID.S,
        };
    } catch (error) {
        throw new Error(`Error getting key info: ${error.message}`);
    }
}

async function loadWallet(blockchain, keyInfoId, walletIndex) {
    try {
        // Fetching Key Info (Assuming ddb is DynamoDB Document Client)
        const keyInfo = await getKeyInfo(keyInfoId); // Replace with your method to get KeyInfo from DynamoDB
        console.log('Key info to use:', keyInfo);

        // Getting Secret Value from Secrets Manager
        const userSecretOutput = await secretsManager.getSecretValue({
            SecretId: keyInfo.SecretsManagerARN,
        }).promise();

        // Decrypting Entropy with KMS
        const decrypted = await kms.decrypt({
            KeyId: keyInfo.KMSKeyID,
            CiphertextBlob: userSecretOutput.SecretBinary,
        }).promise();

        const userEntropy = decrypted.Plaintext;

        // Load HD Wallet & Derive Account (Assuming you have equivalent methods in JS)
        const hdWallet = loadHDWallet(userEntropy); // Replace with your method to load HD Wallet
        const account = hdWallet.derivePath(getHDWalletPath(walletIndex)); // Replace with your method to derive account

        return { hdWallet, account };
    } catch (error) {
        throw new Error(`Error loading wallet: ${error.message}`);
    }
}

async function sendTransaction(adminAccountAddress, userAccountAddress, privateKey) {
    try {
        // const adminAccountAddress = '0x...'; // Replace with the admin account address
        // const userAccountAddress = '0x...'; // Replace with the user account address
        // const privateKey = '0x...'; // Replace with the private key of the admin account
        
        const gasPrice = Web3.utils.toWei('3', 'gwei'); // Replace with the desired gas price
        const tokenTransferCost = 31000; // Replace with the desired approval cost

        // Getting Nonce for the Admin Account
        const adminNonce = await web3.eth.getTransactionCount(adminAccountAddress);

        // Constructing Transaction Object
        const txObject = {
            gasPrice: gasPrice,
            gas: 21000,
            to: userAccountAddress,
            value: Web3.utils.toWei((tokenTransferCost * gasPrice).toString(), 'wei'),
            nonce: adminNonce
        };

        // Signing Transaction
        const signedTx = await web3.eth.accounts.signTransaction(txObject, privateKey);

        // Sending Transaction
        const txReceipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        console.log('Transaction successful with hash:', txReceipt.transactionHash);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

exports.handler = async (event) => {
    try {
        // Connecting to Ethereum Node (use appropriate provider)

        // Replace with the actual blockchains you are interested in
        const blockchains = ['BNBSmartChain'];

        for (const blockchain of blockchains) {
            // const params = {
            //     TableName: "blockchain-balance",
            //     KeyConditionExpression: "#bc = :blockchain",
            //     FilterExpression: "#balance > :minBalance", // Filtering items with Balance > 100
            //     ExpressionAttributeNames: {
            //         "#bc": "Blockchain",
            //         "#balance": "Balance",
            //     },
            //     ExpressionAttributeValues: {
            //         ":blockchain": { S: blockchain },
            //         ":minBalance": { N: "10" } // Assuming the 'Balance' attribute is of type Number
            //     },
            // };

            // const data = await dynamoDBClient.send(new QueryCommand(params));

            // if (!data.Items || data.Items.length === 0) continue;

            // const maxQueries = 3; // Limiting the number of queries to 3
            // let queryCount = 0; // To keep track of how many items have been processed

            // const tokenAddress = "0xb700597d8425ced17677bc68042d7d92764acf59";

            // for (const item of data.Items) {
            //     if (queryCount++ >= maxQueries) break; // Break out of the loop after processing 3 items

            //     const walletAddress = item.Address.S; // Replace with actual attribute name

            //     // Constructing contract instance to interact with ERC-20 Token
            //     const contract = new web3.eth.Contract(erc20ABI, tokenAddress);
            //     const balance = await contract.methods.balanceOf(walletAddress).call();
            //     console.log(`Blockchain: ${blockchain}, Token Address: ${tokenAddress}, Wallet Address: ${walletAddress}, Balance: ${balance}`);
            // }

            try {
                const keyInfoId = 'admin-key-info';
                const walletIndex = 0; // Your wallet index

                const { hdWallet, account } = await loadWallet(blockchain, keyInfoId, walletIndex);
                console.log('Account:', account.getWallet().getAddressString());

                await sendTransaction(account.getWallet().getAddressString(), "0x6E5AB69eeC5d80A87bb0b45d48fdacE4BF18Aa6c", account.getWallet().getPrivateKeyString());
            } catch (error) {
                console.error('Error:', error.message);
            }
        }

        return { statusCode: 200, body: JSON.stringify('Function executed successfully!') };
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify('Internal Server Error') };
    }
};
