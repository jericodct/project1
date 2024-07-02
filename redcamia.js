const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const path = require('path');
const { execSync } = require('child_process');

// Function to detect tilt using Python script
function detectTilt(inputPath) {
    const command = `python3 detect_tilt.py ${inputPath}`;
    const tiltAngle = execSync(command).toString().trim();
    return parseFloat(tiltAngle);
}

// Function to deskew an image
async function deskewImage(inputPath, outputPath, angle) {
    await sharp(inputPath).rotate(-angle).toFile(outputPath);
    return outputPath;
}

// Function to preprocess and extract the regions of interest with different top values
async function preprocessAndExtractRegions(inputPath, priceOutputPath, topValues) {
    // Detect tilt angle
    const tiltAngle = detectTilt(inputPath);
    console.log(`Detected tilt angle: ${tiltAngle} degrees`);

    // Deskew the image if the tilt angle is significant (e.g., more than 1 degree)
    const deskewedImagePath = (tiltAngle > 1 || tiltAngle < -1) ? await deskewImage(inputPath, path.resolve('deskewed_' + path.basename(inputPath)), tiltAngle) : inputPath;

    // Load the deskewed or original image
    const image = sharp(deskewedImagePath);

    // Resize the image to the desired dimensions
    const resizedImage = await image.resize(418, 208).toBuffer();

    // Load the resized image into sharp
    const resizedSharpImage = sharp(resizedImage);
    const metadata = await resizedSharpImage.metadata();

    // Extract and save the label region for each top value
    const labelOutputPaths = [];
    for (let top of topValues) {
        const labelRegion = {
            left: 0,
            top: top,
            width: metadata.width,
            height: Math.round(metadata.height * 0.2)
        };

        if (labelRegion.left + labelRegion.width <= metadata.width && labelRegion.top + labelRegion.height <= metadata.height) {
            const labelOutputPath = `label_region_top_${top}.png`;
            await sharp(resizedImage).extract(labelRegion).toFile(labelOutputPath);
            console.log(`Label region with top ${top} saved to ${labelOutputPath}`);
            labelOutputPaths.push(labelOutputPath);
        } else {
            console.log(`Label region with top ${top} is out of image bounds`);
        }
    }

    // Process the price region
    const priceRegion = {
        left: 0,
        top: 55,
        width: metadata.width,
        height: Math.round(metadata.height * 0.3)
    };

    if (priceRegion.left + priceRegion.width <= metadata.width && priceRegion.top + priceRegion.height <= metadata.height) {
        const priceRegionImage = await sharp(resizedImage)
            .extract(priceRegion)
            .toColourspace('b-w')
            .threshold(150)
            .toBuffer();
        await sharp(priceRegionImage).toFile(priceOutputPath);
        console.log('Price region saved to', priceOutputPath);
    } else {
        console.log('Price extract area is out of image bounds');
    }

    return labelOutputPaths;
}

// Function to perform OCR on the extracted regions
async function performOCR(imagePath) {
    console.time(`OCR for ${imagePath}`);
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
    console.timeEnd(`OCR for ${imagePath}`);
    console.log('OCR Result from', imagePath, ':', text);
    return text.trim();
}

// Main function to process the image and extract text from the label and price regions
async function processPriceTagImage(inputImagePath) {
    const priceOutputPath = 'price_region.png';
    const topValues = Array.from({ length: 15 }, (_, i) => 110 + i); // Range from 110 ~

    try {
        console.time('Total Processing Time');
        const labelOutputPaths = await preprocessAndExtractRegions(inputImagePath, priceOutputPath, topValues);

        // Perform OCR on the extracted label regions
        for (const labelOutputPath of labelOutputPaths) {
            const labelText = await performOCR(labelOutputPath);
            console.log(`Extracted Label Text from ${labelOutputPath}:`, labelText);
        }

        // Perform OCR on the extracted price region
        const priceText = await performOCR(priceOutputPath);
        console.log('Extracted Price Text:', priceText);

        console.timeEnd('Total Processing Time');
    } catch (error) {
        console.error('Error processing image:', error);
    }
}

// Example usage
const inputImagePath = path.resolve(__dirname, '1.jpg');
processPriceTagImage(inputImagePath);
