const QRCode = require('qrcode')
const PDFLib = require('pdf-lib')

const util = require('util')
const fs = require('fs')

const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

const profile = require('./profile.json')

const start = async () => {
    const now = new Date()
    const reasons = ["achats"]

    profile.datesortie = `${("0" + (now.getDate())).slice(-2)}/${("0" + (now.getMonth() + 1)).slice(-2)}/${now.getFullYear()}`
    profile.heuresortie = `${("0" + now.getHours()).slice(-2)}:${(Math.floor(now.getMinutes() / 10) + "0")}`

    console.log(profile, reasons)
    const templateName = "./templates/certificate01.pdf"
    const signatureName = "./signature.png"
    const pdfBytes = await generatePdf(profile, reasons, templateName, signatureName)

    const fileName = "./docs/attestation.pdf" // `docs/attestation-${creationDate}_${creationHour}.pdf`
    await writeFile(fileName, pdfBytes)
}

async function generatePdf(profile, reasons, pdfBase, signatureBase = undefined) {
    const ys = { travail: 585, achats: 536, sante: 488, famille: 451, handicap: 415, sport_animaux: 391, convocation: 318, missions: 293, enfants: 269 }

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

    drawText(`${firstname} ${lastname}`, 137, 701)
    drawText(birthday, 137, 683)
    drawText(placeofbirth, 200, 683)
    drawText(`${address} ${zipcode} ${city}`, 137, 664)

    reasons.forEach(reason => drawText('x', 72, ys[reason], 18))

    drawText(profile.city, 110, 233)
    drawText(`${profile.datesortie}`, 95, 215)
    drawText(`${profile.heuresortie}`, 284, 215)

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

    page1.drawImage(qrImage, { x: page1.getWidth() - 170, y: 140, width: 120, height: 120 })

    pdfDoc.addPage()
    const page2 = pdfDoc.getPages()[1]
    page2.drawImage(qrImage, { x: 50, y: page2.getHeight() - 350, width: 300, height: 300 })

    return pdfDoc.save()
}

start()
