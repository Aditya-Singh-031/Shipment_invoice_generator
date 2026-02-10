const { createReport } = require('docx-templates');
const fs = require('fs');
const path = require('path');

/**
 * Generates a DOCX file from a template by replacing placeholders with data.
 */
const generateDocument = async (templateName, data, outputFormat) => {
    try {
        // --- FIX: Point to "word docs" folder instead of "templates" ---
        // __dirname is the 'services' folder. '..' goes up to root. 'word docs' enters your folder.
        const templatePath = path.join(__dirname, '..', 'word docs', templateName);

        // Debugging: Print where we are looking (helps you spot typos)
        console.log(`🔍 Looking for template at: ${templatePath}`);

        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found: ${templatePath}`);
        }

        const templateBuffer = fs.readFileSync(templatePath);

        // Run the replacement
        const buffer = await createReport({
            template: templateBuffer,
            data: data,
            // This allows using simple curly braces like {CHA_NAME} in Word
            cmdDelimiter: ['{', '}'], 
            noSandbox: true
        });

        return Buffer.from(buffer);

    } catch (error) {
        console.error("Error in generateDocument:", error);
        throw error;
    }
};

module.exports = { generateDocument };