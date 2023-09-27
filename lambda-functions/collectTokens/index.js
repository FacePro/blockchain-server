const { DynamoDBClient, GetItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { Web3 } = require('web3');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager({ region: "us-east-1" });
const kms = new AWS.KMS({ region: "us-east-1" });

const bip39 = require('bip39');
const EthereumWallet = require('ethereumjs-wallet');

// Set up CSV writer
const csvWriter = createCsvWriter({
    path: 'out.csv',
    header: [
        { id: 'address', title: 'ADDRESS' },
        { id: 'index', title: 'INDEX' },
        { id: 'balance', title: 'BALANCE' }
    ],
    append: true
});

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
    },
    {
        "constant": false,
        "inputs": [
            {
                "name": "recipient",
                "type": "address"
            },
            {
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "transfer",
        "outputs": [
            {
                "name": "",
                "type": "bool"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
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

async function getWalletIndexByUserId(userId) {
    try {
        const params = {
            TableName: 'user-deposit-keys',
            Key: {
                'UserID': { S: userId }, // Assuming UserId is of type String
            },
            ProjectionExpression: 'WalletIndex', // Only get WalletIndex field
        };

        const command = new GetItemCommand(params);
        const response = await dynamoDBClient.send(command);

        if (!response.Item) {
            console.log(`No item found for UserId: ${userId}`);
            return null;
        }

        return response.Item.WalletIndex.N; // Assuming WalletIndex is of type Number
    } catch (error) {
        console.error(`Error getting WalletIndex for UserId ${userId}:`, error);
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
        const tokenTransferCost = 40000; // Replace with the desired approval cost

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

async function transferTokens(adminAccountAddress, userAccountAddress, contractAddress, privateKey, amount) {
    try {
        const account = userAccountAddress; // Sender's address, replace with actual address
        const recipient = adminAccountAddress; // Recipient's address, replace with actual address

        // Initialize contract
        const contract = new web3.eth.Contract(erc20ABI, contractAddress);

        // Construct the transaction data
        const data = contract.methods.transfer(recipient, amount).encodeABI();

        const gasPrice = Web3.utils.toWei('3', 'gwei'); // Replace with the desired gas price

        // Set up the transaction object
        const tx = {
            from: account,
            to: contractAddress,
            gasPrice: gasPrice,
            gas: 40000, // Adjust as needed
            data: data
        };

        // Sign and send the transaction
        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        console.log('Transaction Receipt:', receipt);
    } catch (error) {
        console.error('Error executing transfer:', error);
    }
}


exports.handler = async (event) => {
    try {
        // Connecting to Ethereum Node (use appropriate provider)

        // Replace with the actual blockchains you are interested in
        const blockchains = ['BNBSmartChain'];
        const adminKeyInfoId = 'admin-key-info';
        const userKeyInfoId = 'user-key-info';

        // todo: get all users addresses from wallet index directly instead of query blockchain-balance table

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
            //         ":minBalance": { N: "100" } // Assuming the 'Balance' attribute is of type Number
            //     },
            // };

            // const data = await dynamoDBClient.send(new QueryCommand(params));

            // if (!data.Items || data.Items.length === 0) continue;

            const maxQueries = 1; // Limiting the number of queries to 3
            let queryCount = 0; // To keep track of how many items have been processed

            const tokenAddress = "0xb700597d8425ced17677bc68042d7d92764acf59";

            let adminAccount;

            try {

                const { account } = await loadWallet(blockchain, adminKeyInfoId, 0);
                if (!account) {
                    console.error('Error:', 'Admin account not found');
                    break;
                }

                adminAccount = account;
                console.log('Admin Account:', adminAccount.getWallet().getAddressString());

            } catch (error) {
                console.error('Error:', error.message);
            }

            // const maxUserIndex = 4431;
            const amountToKeep = web3.utils.toWei('10', 'ether'); // assuming the token has 18 decimals
            // let records = [];

            // for (let i = 0; i <= maxUserIndex; i++) {
                try {
                    const { account } = await loadWallet(blockchain, userKeyInfoId, 2);
                    const walletAddress = account.getWallet().getAddressString(); // Replace with actual attribute name

                    // Constructing contract instance to interact with ERC-20 Token
                    const contract = new web3.eth.Contract(erc20ABI, tokenAddress);
                    const balance = await contract.methods.balanceOf(walletAddress).call();
                    console.log(`Wallet Address: ${walletAddress}, Balance: ${balance}`);

                    if (balance > 0) {
                        const amountToTransfer = BigInt(balance) - BigInt(amountToKeep);
                        // await sendTransaction(adminAccount.getWallet().getAddressString(), walletAddress, adminAccount.getWallet().getPrivateKeyString());
                        await transferTokens(adminAccount.getWallet().getAddressString(), walletAddress, tokenAddress, account.getWallet().getPrivateKeyString(), amountToTransfer);
                    }

                } catch (error) {
                    console.error('Error:', error.message);
                }
                // console.log(`Processed ${i} of records`);
            // }
            // console.log(records);

            // if (records.length > 0) {
            //     await csvWriter.writeRecords(records);
            //     console.log(`Written remaining ${records.length} records to out.csv`);
            // }

            // if(balance <= 100000) continue;

            // const amountToTransfer = balance - amountToKeep;
            // await sendTransaction(adminAccount.getWallet().getAddressString(), walletAddress, adminAccount.getWallet().getPrivateKeyString());

            // await transferTokens(adminAccount.getWallet().getAddressString(), walletAddress, account.getWallet().getPrivateKeyString(), amountToTransfer);
            // if (queryCount++ >= maxQueries) break;
        }

        return { statusCode: 200, body: JSON.stringify('Function executed successfully!') };
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify('Internal Server Error') };
    }
};
