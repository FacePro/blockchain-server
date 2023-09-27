const readline = require('readline');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Setup the CSV writers
const inputCsvWriter = createCsvWriter({
    path: 'out.csv', // Your input CSV file
    header: [
        { id: 'address', title: 'ADDRESS' },
        { id: 'index', title: 'INDEX' },
        { id: 'balance', title: 'BALANCE' },
    ],
    append: false,
});

const outputCsvWriter = createCsvWriter({
    path: 'adjusted.csv', // Your output CSV file
    header: [
        { id: 'address', title: 'ADDRESS' },
        { id: 'index', title: 'INDEX' },
        { id: 'balance', title: 'ADJUSTED_BALANCE' },
    ],
    append: false,
});

async function adjustBalances() {
    const fileStream = fs.createReadStream('out.csv'); // Replace with your input file path
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const records = [];
    
    for await (const line of rl) {
        const fields = line.split(','); // Assuming fields are separated by comma
        if(fields.length > 2) {
            const originalBalance = BigInt(fields[2]);
            const adjustedBalance = Number(originalBalance) / 1e18;
            records.push({
                address: fields[0],
                index: fields[1],
                balance: adjustedBalance.toFixed(2) // Adjust the number of decimal places as needed
            });
        }
    }

    await outputCsvWriter.writeRecords(records);
    console.log(`Adjusted balances written to adjusted.csv`);
}

adjustBalances().catch(console.error);
