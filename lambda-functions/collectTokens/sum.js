const readline = require('readline');
const fs = require('fs');

function formatWithCommas(bigIntValue) {
    return bigIntValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatHumanReadable(bigIntValue) {
    const value = parseFloat(bigIntValue.toString());
    if (value < 1e3) return value.toString();
    if (value < 1e6) return (value / 1e3).toFixed(1) + 'K';
    if (value < 1e9) return (value / 1e6).toFixed(1) + 'M';
    if (value < 1e12) return (value / 1e9).toFixed(1) + 'B';
    return (value / 1e12).toFixed(1) + 'T';
}

async function sumLastField(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity // Consider \r\n and \n as a line break
    });

    let total = BigInt(0);

    for await (const line of rl) {
        const fields = line.split(','); // Assuming fields are separated by comma
        if(fields.length > 2) { // Ensure there are at least three fields
            const value = BigInt(fields[2]); // Convert the last field to BigInt for summation
            total += value;
        }
    }

    return total;
}

async function main() {
    const filePath = 'out.csv'; // Replace with the path to your CSV file
    const total = await sumLastField(filePath);
    const adjustedTotal = Number(total) / 1e18;

    console.log(`Total(formatWithCommas): ${formatWithCommas(adjustedTotal.toFixed(2))}`);
    console.log(`Total(formatHumanReadable): ${formatHumanReadable(adjustedTotal)}`);
}

main().catch(console.error);
