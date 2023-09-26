const { handler } = require('./index'); // assuming your lambda is in index.js

async function run() {
  try {
    const result = await handler({
      // Pass any event object you want to test with new
    });
    console.log('Function executed successfully:', result);
  } catch (err) {
    console.error('Error executing function:', err);
  }
}

run();
