const QRCode = require('qrcode')
const PDFLib = require('pdf-lib')

const util = require('util')
const fs = require('fs')

const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

const profile = require('./profile.json')

const start = async () => {
    const now = new Date()
    const reasons = ["achats_culturel_cultuel"]

    profile.datesortie = `${("0" + (now.getDate())).slice(-2)}/${("0" + (now.getMonth() + 1)).slice(-2)}/${now.getFullYear()}`
    profile.heuresortie = `${("0" + now.getHours()).slice(-2)}:${(Math.floor(now.getMinutes() / 10) + "0")}`

    console.log(profile, reasons)
    const templateName = "./templates/certificate02.pdf"
    const signatureName = "./signature.png"
    const pdfBytes = await generatePdf(profile, reasons, templateName, signatureName)

    const fileName = "./docs/attestation.pdf"
    await writeFile(fileName, pdfBytes)
}

async function generatePdf(profile, reasons, pdfBase, signatureBase = undefined) {
    const ys = {
        travail: 553, achats_culturel_cultuel: 482, sante: 434, famille: 410, handicap: 373,
        sport_animaux: 349, convocation: 276, missions: 252, enfants: 228,
    }

    const { lastname, firstname, birthday, placeofbirth, address, zipcode, city, datesortie, heuresortie } = profile

    const data = [
        `Cree le: ${datesortie} a 07h25`,
        `Nom: ${lastname}`,
        `Prenom: ${firstname}`,
        `Naissance: ${birthday} a ${placeofbirth}`,
        `Adresse: ${address} ${zipcode} ${city}`,
        `Sortie: ${datesortie} a ${heuresortie}`,
        `Motifs: ${reasons.join(', ')}`
    ].join(';\n') + ";"

    console.log(data)

    const existingPdfBytes = await readFile(pdfBase)

    const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes)

    pdfDoc.setTitle('COVID-19 - Déclaration de déplacement')
    pdfDoc.setSubject('Attestation de déplacement dérogatoire')
    pdfDoc.setKeywords(['covid19', 'covid-19', 'attestation', 'déclaration', 'déplacement', 'officielle', 'gouvernement'])
    pdfDoc.setProducer('DNUM/SDIT')
    pdfDoc.setCreator('')
    pdfDoc.setAuthor("Ministère de l'intérieur")

    const page1 = pdfDoc.getPages()[0]

    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica)
    const drawText = (text, x, y, size = 11) => page1.drawText(text, { x, y, size, font })

    drawText(`${firstname} ${lastname}`, 92, 702)
    drawText(birthday, 92, 684)
    drawText(placeofbirth, 214, 684)
    drawText(`${address} ${zipcode} ${city}`, 104, 665)

    reasons.forEach(reason => drawText('x', 47, ys[reason], 12))

    drawText(profile.city, 78, 76)
    drawText(`${profile.datesortie}`, 63, 58)
    drawText(`${profile.heuresortie}`, 227, 58)

    if (signatureBase) {
        const signatureBytes = await readFile(signatureBase)
        const signatureImage = await pdfDoc.embedPng(signatureBytes)
        page1.drawImage(signatureImage, { x: page1.getWidth() - 470, y: 150, width: 100, height: 45 })
    } else {
        drawText(`${profile.signature}`, 150, 170, 20)
    }

    const opts = { errorCorrectionLevel: 'M', type: 'image/png', quality: 0.92, margin: 1 }
    const generatedQR = await QRCode.toDataURL(data, opts)

    const qrImage = await pdfDoc.embedPng(generatedQR)

    page1.drawImage(qrImage, { x: page1.getWidth() - 156, y: 25, width: 92, height: 92 })

    pdfDoc.addPage()
    const page2 = pdfDoc.getPages()[1]
    page2.drawImage(qrImage, { x: 50, y: page2.getHeight() - 390, width: 300, height: 300 })

    return pdfDoc.save()
}

start()
