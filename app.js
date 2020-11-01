const QRCode = require('qrcode')
const PDFLib = require('pdf-lib')

const util = require('util')
const fs = require('fs')

const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

const profile = require('./profile.json')

const start = async () => {
    const now = new Date()
    const reasons = "achats"

    profile.datesortie = `${("0" + (now.getDay() + 1)).slice(-2)}/${("0" + (now.getMonth() + 1)).slice(-2)}/${now.getFullYear()}`
    profile.heuresortie = `${now.getHours()}:${now.getMinutes()}`

    console.log(profile, reasons)
    const pdfBytes = await generatePdf(profile, reasons, './certificate.pdf')

    const fileName = "docs/attestation.pdf" // `docs/attestation-${creationDate}_${creationHour}.pdf`
    await writeFile(fileName, pdfBytes)
}

async function generatePdf(profile, reasons, pdfBase) {
    const ys = { travail: 578, achats: 533, sante: 477, famille: 435, handicap: 396, sport_animaux: 358, convocation: 295, missions: 255, enfants: 211 }

    const { lastname, firstname, birthday, placeofbirth, address, zipcode, city, datesortie, heuresortie } = profile

    const data = [
        `Cree le: ${datesortie} a 06h05`,
        `Nom: ${lastname}`,
        `Prenom: ${firstname}`,
        `Naissance: ${birthday} a ${placeofbirth}`,
        `Adresse: ${address} ${zipcode} ${city}`,
        `Sortie: ${datesortie} a ${heuresortie}`,
        `Motifs: ${reasons}`,
    ].join(';\n ')

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
    const drawText = (text, x, y, size = 11) => {
        page1.drawText(text, { x, y, size, font })
    }

    drawText(`${firstname} ${lastname}`, 119, 696)
    drawText(birthday, 119, 674)
    drawText(placeofbirth, 297, 674)
    drawText(`${address} ${zipcode} ${city}`, 133, 652)

    reasons.split(', ').forEach(reason => drawText('x', 78, ys[reason], 18))

    drawText(profile.city, 105, 177, 11)
    drawText(`${profile.datesortie}`, 91, 153, 11)
    drawText(`${profile.heuresortie}`, 264, 153, 11)

    // TODO drawImage
    drawText(`${profile.signature}`, 150, 110, 20)

    const generatedQR = await generateQR(data)

    const qrImage = await pdfDoc.embedPng(generatedQR)

    page1.drawImage(qrImage, { x: page1.getWidth() - 156, y: 100, width: 92, height: 92 })

    pdfDoc.addPage()
    const page2 = pdfDoc.getPages()[1]
    page2.drawImage(qrImage, { x: 50, y: page2.getHeight() - 350, width: 300, height: 300 })

    return await pdfDoc.save()
}

async function generateQR(text) {
    const opts = { errorCorrectionLevel: 'M', type: 'image/png', quality: 0.92, margin: 1 }
    return QRCode.toDataURL(text, opts)
}

start()
