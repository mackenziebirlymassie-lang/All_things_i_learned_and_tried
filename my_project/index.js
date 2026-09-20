// ===============================================================
// Advanced JavaScript Example with Heavy Commenting
// This file demonstrates many JavaScript concepts in a single script:
//
// - variables and constants
// - functions
// - conditional logic
// - loops
// - arrays and objects
// - maps, filters, and reducers
// - classes
// - validation
// - string formatting
// - async programming
// - data processing and reporting
// - sorting and searching
// - mathematical checks
//
// This version is designed to be run in Node.js
// ===============================================================

// ---------------------------------------------------------------
// 1) Basic setup
// ---------------------------------------------------------------
// The original file had a single variable called "number".
// We will keep that idea but make the script much more advanced.
const number = 92;

// This array holds many values for analysis.
const dataset = [12, 25, 92, 100, 7, 40, 88, 64, 99, 33, 77, 41, 59, 83, 91, 50];

// ---------------------------------------------------------------
// 2) Utility functions
// ---------------------------------------------------------------

// This function checks whether a value is a valid finite number.
// We use typeof and Number.isFinite to avoid NaN / Infinity issues.
function isValidNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

// This function returns whether a value is even.
// Even numbers are divisible by 2 without a remainder.
function isEvenNumber(value) {
    return isValidNumber(value) && value % 2 === 0;
}

// This function returns whether a value is odd.
// Odd numbers leave a remainder of 1 when divided by 2.
function isOddNumber(value) {
    return isValidNumber(value) && value % 2 !== 0;
}

// This function checks if a value is prime.
// Prime numbers only divide evenly by 1 and themselves.
function isPrimeNumber(value) {
    if (!isValidNumber(value) || value < 2) {
        return false;
    }

    for (let i = 2; i <= Math.sqrt(value); i++) {
        if (value % i === 0) {
            return false;
        }
    }

    return true;
}

// This helper creates a cleaned number string.
// It ensures the number is formatted to 2 decimal places.
function formatNumber(value) {
    if (!isValidNumber(value)) {
        return "Invalid number";
    }

    return Number(value).toFixed(2);
}

// This function calculates the factorial of a positive integer.
// Example: 5! = 5 * 4 * 3 * 2 * 1 = 120
function factorial(value) {
    if (!Number.isInteger(value) || value < 0) {
        return "Factorial is only defined for non-negative integers.";
    }

    if (value === 0) return 1;

    let result = 1;
    for (let i = 1; i <= value; i++) {
        result *= i;
    }

    return result;
}

// This function returns the sum of all digits in a number.
// Example: 92 -> 11
function sumOfDigits(value) {
    if (!isValidNumber(value)) {
        return "Invalid input";
    }

    const str = String(Math.trunc(value));
    let total = 0;

    for (const char of str) {
        total += Number(char);
    }

    return total;
}

// This function finds all factors of a positive integer.
// Example: factors of 12 = [1, 2, 3, 4, 6, 12]
function getFactors(value) {
    if (!isValidNumber(value) || !Number.isInteger(value) || value <= 0) {
        return [];
    }

    const factors = [];

    for (let i = 1; i <= value; i++) {
        if (value % i === 0) {
            factors.push(i);
        }
    }

    return factors;
}

// ---------------------------------------------------------------
// 3) Main number evaluator
// ---------------------------------------------------------------
// This function analyzes a number and returns a detailed object.
function evaluateNumber(value) {
    // Guard clause: reject invalid input immediately.
    if (!isValidNumber(value)) {
        return {
            status: "invalid",
            value,
            message: "Input must be a valid number."
        };
    }

    let category = "";
    let message = "";

    // A rich set of conditions for classification.
    if (value < 20) {
        category = "Very Low";
        message = "Number is less than 20";
    } else if (value >= 20 && value < 50) {
        category = "Low";
        message = "Number is between 20 and 49";
    } else if (value >= 50 && value < 80) {
        category = "Medium";
        message = "Number is between 50 and 79";
    } else if (value >= 80 && value < 100) {
        category = "High";
        message = "Number is between 80 and 99";
    } else {
        category = "Very High";
        message = "Number is 100 or more";
    }

    return {
        status: "valid",
        value,
        category,
        message,
        isEven: isEvenNumber(value),
        isOdd: isOddNumber(value),
        isPrime: isPrimeNumber(value),
        digitsSum: sumOfDigits(value),
        factors: getFactors(value),
        factorial: factorial(Math.trunc(value)),
        formatted: formatNumber(value)
    };
}

// ---------------------------------------------------------------
// 4) Data processing functions
// ---------------------------------------------------------------

// This function processes an array of numbers and returns a rich dataset.
function processNumbers(values) {
    return values.map((value) => ({
        rawValue: value,
        evaluation: evaluateNumber(value)
    }));
}

// This function filters only high-value numbers.
function getHighPriorityNumbers(items) {
    return items.filter((item) => {
        const category = item.evaluation.category;
        return category === "High" || category === "Very High";
    });
}

// This function calculates the average of a dataset.
function getAverage(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return 0;
    }

    const total = values.reduce((sum, current) => sum + current, 0);
    return total / values.length;
}

// This function returns the largest number in a dataset.
function getMax(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return null;
    }

    return Math.max(...values);
}

// This function returns the smallest number in a dataset.
function getMin(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return null;
    }

    return Math.min(...values);
}

// This function sorts numbers ascending.
function sortAscending(values) {
    return [...values].sort((a, b) => a - b);
}

// This function sorts numbers descending.
function sortDescending(values) {
    return [...values].sort((a, b) => b - a);
}

// ---------------------------------------------------------------
// 5) Class example
// ---------------------------------------------------------------
// A class helps organize code into a reusable structure.
class NumberTracker {
    constructor(name, initialValue = 0) {
        this.name = name;
        this.value = initialValue;
        this.history = [initialValue];
    }

    add(amount) {
        if (!isValidNumber(amount)) {
            console.log("Invalid amount supplied. Operation ignored.");
            return this;
        }

        this.value += amount;
        this.history.push(this.value);

        return this;
    }

    subtract(amount) {
        if (!isValidNumber(amount)) {
            console.log("Invalid amount supplied. Operation ignored.");
            return this;
        }

        this.value -= amount;
        this.history.push(this.value);

        return this;
    }

    reset() {
        this.value = 0;
        this.history = [0];
        return this;
    }

    summary() {
        return {
            name: this.name,
            currentValue: this.value,
            history: this.history,
            lastValue: this.history[this.history.length - 1]
        };
    }
}

// ---------------------------------------------------------------
// 6) Object and nested data example
// ---------------------------------------------------------------
// This is a realistic data structure with nested values.
const report = {
    title: "Number Analysis Report",
    baseNumber: number,
    dataset: dataset,
    analysis: {
        total: dataset.reduce((sum, value) => sum + value, 0),
        average: getAverage(dataset),
        highest: getMax(dataset),
        lowest: getMin(dataset),
        sortedAscending: sortAscending(dataset),
        sortedDescending: sortDescending(dataset)
    },
    metadata: {
        generatedAt: new Date().toISOString(),
        version: "1.0.0",
        author: "Copilot"
    }
};

// ---------------------------------------------------------------
// 7) Advanced conditional logic
// ---------------------------------------------------------------
// This demonstrates nested ternary operators and branching.
const score = 92;

const grade =
    score >= 90
        ? "A"
        : score >= 80
            ? "B"
            : score >= 70
                ? "C"
                : score >= 60
                    ? "D"
                    : "F";

const performanceMessage =
    grade === "A"
        ? "Excellent performance"
        : grade === "B"
            ? "Very good"
            : grade === "C"
                ? "Average"
                : "Needs improvement";

// ---------------------------------------------------------------
// 8) Another useful function: arithmetic stats
// ---------------------------------------------------------------
function calculateStats(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return {
            count: 0,
            total: 0,
            average: 0,
            min: null,
            max: null
        };
    }

    const total = values.reduce((sum, value) => sum + value, 0);

    return {
        count: values.length,
        total,
        average: total / values.length,
        min: getMin(values),
        max: getMax(values)
    };
}

// ---------------------------------------------------------------
// 9) Async example
// ---------------------------------------------------------------
// This simulates fetching and processing data asynchronously.
// It uses Promise and async/await, which are common in real JavaScript projects.
function simulateDataFetch() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                status: "success",
                data: dataset,
                timestamp: new Date().toISOString()
            });
        }, 1000);
    });
}

// This async function waits for the simulated fetch and then computes summary.
async function loadAndProcessData() {
    const result = await simulateDataFetch();
    const stats = calculateStats(result.data);
    const processed = processNumbers(result.data);

    return {
        result,
        stats,
        processed
    };
}

// ---------------------------------------------------------------
// 10) Main execution block
// ---------------------------------------------------------------
// This is the actual script flow.
// We call the functions and print the results.
console.log("==============================================================");
console.log("Java script test.01");
console.log("==============================================================");

// Basic direct check from the original file
if (number < 20) {
    console.log("Number is less than 20");
} else {
    console.log("Number is greater than or equal to 20");
}

// Detailed evaluation of the original number
console.log("\n--- Original Number Analysis ---");
console.log(evaluateNumber(number));

// Process the dataset
console.log("\n--- Dataset Analysis ---");
const processedDataset = processNumbers(dataset);
console.log(processedDataset);

// Filter out only high priority values
console.log("\n--- High Priority Numbers ---");
console.log(getHighPriorityNumbers(processedDataset));

// Calculate average / min / max
console.log("\n--- Dataset Stats ---");
console.log(calculateStats(dataset));

// Sort numbers
console.log("\n--- Ascending Sort ---");
console.log(sortAscending(dataset));
console.log("\n--- Descending Sort ---");
console.log(sortDescending(dataset));

// Test the class
console.log("\n--- Number Tracker Example ---");
const tracker = new NumberTracker("Main Tracker", number);
tracker.add(8).add(12).subtract(5);
console.log(tracker.summary());

// Grade check
console.log("\n--- Grade Evaluation ---");
console.log(`Score: ${score}, Grade: ${grade}, Message: ${performanceMessage}`);

// Prime and factor check
console.log("\n--- Prime / Factor Example ---");
console.log(`Is 92 prime? ${isPrimeNumber(92)}`);
console.log(`Factors of 92: ${getFactors(92)}`);
console.log(`Factorial of 5: ${factorial(5)}`);
console.log(`Sum of digits of 92: ${sumOfDigits(92)}`);

// JSON report example
console.log("\n--- Report Object ---");
console.log(JSON.stringify(report, null, 2));

// Async processing
console.log("\n--- Async Data Loading ---");
loadAndProcessData()
    .then((payload) => {
        console.log(payload);
    })
    .catch((error) => {
        console.error("Async process failed:", error);
    });

// Final output summary
console.log("\n==============================================================");
console.log("Script complete.");
console.log("==============================================================");
