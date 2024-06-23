const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const path = require('path');

// Function to preprocess and extract the regions of interest
async function preprocessAndExtractRegions(inputPath, labelOutputPath, priceOutputPath) {
    // Load the input image
    const image = sharp(inputPath);

    // Resize the image to the desired dimensions
    const resizedImage = await image.resize(418, 208).toBuffer();

    // Load the resized image into sharp
    const resizedSharpImage = sharp(resizedImage);

    // Metadata to determine the dimensions of the resized image
    const metadata = await resizedSharpImage.metadata();

    // Define the regions of interest based on the resized image dimensions and known layout
    const labelRegion = {
        left: 0,
        top: 10,
        width: metadata.width,
        height: Math.round(metadata.height * 0.3)
    };

    const priceRegion = {
        left: 190,
        top: 80,
        width: 200,
        height: Math.round(metadata.height * 0.5)
    };

    // Ensure the extract areas are within the resized image dimensions
    if (labelRegion.left + labelRegion.width > metadata.width || labelRegion.top + labelRegion.height > metadata.height) {
        throw new Error('Label extract area is out of image bounds');
    }

    if (priceRegion.left + priceRegion.width > metadata.width || priceRegion.top + priceRegion.height > metadata.height) {
        throw new Error('Price extract area is out of image bounds');
    }

    // Extract and save the label region using a separate sharp instance
    await sharp(resizedImage).extract(labelRegion).toFile(labelOutputPath);
    console.log('Label region saved to', labelOutputPath);

    // Preprocess and extract the price region using a separate sharp instance
    const priceRegionImage = await sharp(resizedImage)
        .extract(priceRegion)
        .toColourspace('b-w') // Convert to black and white
        .threshold(150) // Apply a threshold to binarize
        .toBuffer();

    // Save the preprocessed price region
    await sharp(priceRegionImage).toFile(priceOutputPath);
    console.log('Price region saved to', priceOutputPath);
}

// Function to perform OCR on the extracted regions
async function performOCR(imagePath) {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
        logger: m => console.log(m)
    });

    console.log('OCR Result from', imagePath, ':', text);
    return text;
}

// Main function to process the image and extract text from the label and price regions
async function processPriceTagImage(inputImagePath) {
    const labelOutputPath = 'label_region.png';
    const priceOutputPath = 'price_region.png';

    try {
        await preprocessAndExtractRegions(inputImagePath, labelOutputPath, priceOutputPath);
        const labelText = await performOCR(labelOutputPath);
        const priceText = await performOCR(priceOutputPath);
        console.log('Extracted Label Text:', labelText.trim());
        console.log('Extracted Price Text:', priceText.trim());
    } catch (error) {
        console.error('Error processing image:', error);
    }
}

// Example usage
const inputImagePath = path.resolve(__dirname, 'sample1.jpg');
processPriceTagImage(inputImagePath);
