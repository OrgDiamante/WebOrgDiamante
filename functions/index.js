const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const mercadopago = require('mercadopago');
const qr = require('qrcode');
const https = require('https');
const express = require('express');
const app = express();

const corsOptions = {
    origin:[
        'https://bike-extreme.com',
        'https://www.bike-extreme.com',
        'https://127.0.0.1:5500',
        'https://127.0.0.1',
        'http://127.0.0.1:5500',
        '192.168.0.169:5500',
        'http://192.168.0.169:5500',
        'https://192.168.0.169:5500',
        'https://orgdiamante.app.n8n.cloud'
    ]
}

const cors = require('cors')(corsOptions);

admin.initializeApp();
require('dotenv').config()

const { getDatabase } = require('firebase-admin/database');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const db = getDatabase();

const {SENDER_EMAIL, SENDER_PASSWORD, MERCADO_PAGO_PUBLIC_KEY, MERCADO_PAGO_ACCESS_TOKEN} = process.env;

//#region PROCESSA INSCRIÇÃO
exports.subscriptionRequest = functions.https.onRequest((request, result)=>{
    cors(request, result, () =>{
        try
        {
            mercadopago.configurations.setAccessToken(MERCADO_PAGO_ACCESS_TOKEN);
            var payment_data = JSON.parse(request.query.payment);
            var userModel = JSON.parse(request.query.user); 
            var coupomModel = JSON.parse(request.query.coupom);
            var coupomLocation = request.query.coupomLocation;

            if(coupomLocation != "NO_LOCATION"){
                var coupomReference = db.ref(coupomLocation);
                coupomModel.usos = coupomModel.usos - 1;
                coupomReference.set(coupomModel);
            }

            if(payment_data.payment_method_id == "pix"){
                mercadopago.payment.create(payment_data).then(function (data) {
                    var paymentModel = {
                        uid: userModel.uid,
                        paymentID: data.body.id,
                        description: data.body.description,
                        date_approved: data.body.date_approved,
                        date_of_expiration: data.body.date_of_expiration,
                        date_created: data.body.date_created,
                        date_last_updated: data.body.date_last_updated,
                        payment_method_id: data.body.payment_method_id,
                        status: data.body.status,
                        status_detail: data.body.status_detail,
                        transaction_amount: data.body.transaction_amount,
                        qr_code: data.body.point_of_interaction.transaction_data.qr_code,
                        qr_code_base64: data.body.point_of_interaction.transaction_data.qr_code_base64,
                        payer: {
                            email: userModel.email,
                            id: userModel.ID,
                            phone: userModel.phone,
                            address: userModel.address
                        }
                    }

                    var reference = db.ref("Pagamentos/"+paymentModel.uid);
                    var userReference = db.ref("Participantes/"+userModel.uid)
                    reference.set(paymentModel);
                    userReference.set(userModel);

                    result.send({code: 888, message:"Payment Created Successfully", payment: paymentModel});
                
                }).catch(function (err) {
                    result.send({code:429, message:"An error ocurred while generating the payment", error:err.message})
                });
            }
            else if(payment_data.payment_method_id == "bolbradesco"){
                mercadopago.payment.create(payment_data).then(function (data) {
                    var paymentModel = {
                        uid: userModel.uid,
                        paymentID: data.body.id,
                        description: data.body.description,
                        date_approved: data.body.date_approved,
                        date_of_expiration: data.body.date_of_expiration,
                        date_created: data.body.date_created,
                        date_last_updated: data.body.date_last_updated,
                        payment_method_id: data.body.payment_method_id,
                        status: data.body.status,
                        status_detail: data.body.status_detail,
                        transaction_amount: data.body.transaction_amount,
                        transaction_details_url: data.body.transaction_details.external_resource_url,
                        payer: {
                            email: userModel.email,
                            id: userModel.ID,
                            phone: userModel.phone,
                            address: userModel.address
                        }
                    }

                    var reference = db.ref("Pagamentos/"+paymentModel.uid);
                    var userReference = db.ref("Participantes/"+userModel.uid)
                    reference.set(paymentModel);
                    userReference.set(userModel);

                    result.send({code: 888, message:"Payment Created Successfully", payment: paymentModel});

                }).catch(function (err) {
                    result.send({code:429, message:"An error ocurred while generating the payment", error:err.message})
                });
            }else{
                mercadopago.payment.save(payment_data).then(function(data){
                    var paymentModel = {
                        uid: userModel.uid,
                        paymentID: data.body.id,
                        description: payment_data.description,
                        date_approved: data.body.date_approved,
                        date_of_expiration: data.body.date_of_expiration,
                        date_created: data.body.date_created,
                        date_last_updated: data.body.date_last_updated,
                        payment_method_id: data.body.payment_method_id,
                        status: data.body.status,
                        status_detail: data.body.status_detail,
                        transaction_amount: data.body.transaction_amount,
                        payer: {
                            email: userModel.email,
                            id: userModel.ID,
                            phone: userModel.phone,
                            address: userModel.address
                        }
                    }

                    console.log("PAYMENT STATUS: " + paymentModel.status);
                    if(paymentModel.status == "rejected")
                    {
                        console.log("REJECTED")
                        try{
                            let authData = nodemailer.createTransport({
                                host:'smtp.gmail.com',
                                port:465,
                                secure:true,
                                auth:{
                                    user:SENDER_EMAIL,
                                    pass:SENDER_PASSWORD
                                }
                            });

                            var reference = db.ref("Templates/emails/payment_denied/data/");
                            var errorObj = {code:0, message:""};
                            reference.on('value', (snapshot) => {
                                var htmlBody = snapshot.val();
                        
                                htmlBody = htmlBody.replace("CONTENT_TEXT", `Seu pagamento referente à ${paymentModel.description} foi recusado. Verifique as informações de pagamento inseridas e tente novamente clicando no botão abaixo.`)
                        
                                htmlBody = htmlBody.replace("SUBSCRIPTION_LINK",`https://bike-extreme.com/cadastro?${userModel.category}`)
                                
                                return authData.sendMail({
                                    from: SENDER_EMAIL,
                                    to:`${paymentModel.payer.email}`,
                                    subject:`Pagamento Recusado Inscrição Tromba D'anta - Bike Extreme`,
                                    attachDataUrls:true,
                                    html:`${htmlBody}`
                                })
                                .then(info => {
                                    console.log(info.messageId)
                                    return null;
                                })
                                .catch(error => {
                                    console.log(error)
                                    return null;
                                })
                            },(errorObject) => {
                                errorObj = {code:510, message:errorObject}
                                return errorObj;
                            })
                        }catch(emailError){
                            console.log(emailError.message);
                        }                 
                    }
                    else
                    {
                        var reference = db.ref("Pagamentos/"+paymentModel.uid);
                        var userReference = db.ref("Participantes/"+userModel.uid)
                        reference.set(paymentModel);
                        userReference.set(userModel);
                    }
        
                    result.send({code: 888, message:"Payment Created Successfully", payment: paymentModel});                
                }).catch(function(err){
                    result.send({code:429, message:"An error ocurred while generating the payment", error:err.message})
                })
            }
        }
        catch(err)
        {
            result.send({code:400, message:"An error ocurred while reading the data sent", error:err.message, jsonString: request.query.payment})
        }
    })
})

exports.sendSubscriptionEmail = functions.database.ref('Participantes/{participantID}').onCreate((element, context) =>{
    let participantID = context.params.participantID;
    let participant = element.val();
    
    let authData = nodemailer.createTransport({
        host:'smtp.gmail.com',
        port:465,
        secure:true,
        auth:{
            user:SENDER_EMAIL,
            pass:SENDER_PASSWORD
        }
    });

    var subRef = db.ref("Templates/emails/subscription_bike-extreme/data/");
    var errorObj = {code:0, message:""};
    subRef.on('value', (snap) => {   
        var htmlSub = snap.val();

        htmlSub = htmlSub.replace("PARAGRAPH_FIRST",
        `${participant.name}, sua inscrição no Tromba D'anta Eco Village - Bike Extreme foi `+
        "concluída com sucesso! Veja mais detalhes abaixo:");
            
        htmlSub = htmlSub.replace("NUMERO_DO_TICKET", participant.uid);

        htmlSub = htmlSub.replace("PERCURSO_PARTICIPACAO", participant.category);

        htmlSub = htmlSub.replace("CATEGORIA_PARTICIPACAO", participant.subcategory);

        htmlSub = htmlSub.replace("DATA_DE_CRIACAO",participant.competitionDate);

        htmlSub = htmlSub.replace("PARAGRAPH_SECOND", "Em caso de dúvida ou necessidade de realizar alguma mudança em "+
        "sua inscrição você pode entrar em contato clicando no botão abaixo. Também pode realizar "+
        "o download dos Termos e Condições de Participação do evento abaixo.");

        htmlSub = htmlSub.replace("PARAGRAPH_THIRD", "Esse e-mail não representa confirmação de pagamento da inscrição. "+
        "Caso já tenha realizado o pagamento, a confirmação de inscrição é enviada em até 72h.")

        htmlSub = htmlSub.replace("CONTACT_LINK", "https://api.whatsapp.com/send?phone=5538999882046&text=Ol%C3%A1,%20estou%20com%20algumas%20d%C3%BAvidas%20acerca%20do%20evento%20Tromba%20D'anta%20-%20Bike%20Extreme,%20na%20inscri%C3%A7%C3%A3o%20n%C3%BAmero:%20NUMERO_INSCRICAO".replace("NUMERO_INSCRICAO", participant.uid));
        htmlSub = htmlSub.replace("TERMOS_LINK", "https://firebasestorage.googleapis.com/v0/b/organizacaodiamanteltda.appspot.com/o/Termos%2FTermos_e_Condicoes_Bike_Extreme.pdf?alt=media&token=081444f2-1ca0-45aa-9cab-712b566813e0");

        return authData.sendMail({
            from: SENDER_EMAIL,
            to:`${participant.email}`,
            subject:`Inscrição Realizada nº ${participant.uid}`,
            html:`${htmlSub}`
        })
        .then(info => {
            console.log(info.messageId)
            return null;
        })
        .catch(error => {
            console.log(error)
            return null;
        })
    },(errorObject) => {
        errorObj = {code:510, message:errorObject}
        return errorObj;
    })

    
});
//#endregion

//#region PROCESSA EMAIL DE PAGAMENTO
exports.sendBillingEmail = functions.database.ref('Pagamentos/{paymentID}').onCreate((element, context) => {   
    let paymentModel = element.val();  
    let authData = nodemailer.createTransport({
        host:'smtp.gmail.com',
        port:465,
        secure:true,
        auth:{
            user:SENDER_EMAIL,
            pass:SENDER_PASSWORD
        }
    });

    if(paymentModel.payment_method_id == "pix"){
        var reference = db.ref("Templates/emails/"+paymentModel.payment_method_id+"/data/");
        var errorObj = {code:0, message:""};
        reference.on('value', (snapshot) => {
            var htmlBody = snapshot.val();
    
            var priceForm = new Intl.NumberFormat('pt-BR', {
                style:'currency',
                currency: "BRL",
              });
    
              var date = new Date(paymentModel.date_of_expiration);
              var yyyy = date.getFullYear();
              let mm = date.getMonth() + 1; // Months start at 0!
              let dd = date.getDate();
              
              if (dd < 10) dd = '0' + dd;
              if (mm < 10) mm = '0' + mm;
              var formattedDay = dd + '/' + mm + '/' + yyyy;
    
            htmlBody = htmlBody.replace("CONTENT_TEXT", `O seu PIX referente à ${paymentModel.description}, no valor de `+
            `${priceForm.format(paymentModel.transaction_amount)} e data de vencimento em ${formattedDay}` +
            " já está pronto! Pague agora e risque isso da sua lista de tarefas!")

            qr.toDataURL(paymentModel.qr_code, function(err, code){

                if(err) return console.log("Errror generating QR CODE: " + err.message)

                htmlBody = htmlBody.replace("DATA_QR_CODE",'<img src="' + code + '" style="width: 70%; height: auto; border-radius: 0;">' );
    
                htmlBody = htmlBody.replace("PIX_CODE",`https://api.whatsapp.com/send?phone=5538999882046&text=Ol%C3%A1,%20estou%20com%20algumas%20d%C3%BAvidas%20acerca%20do%20evento%20Tromba%20D'anta%20-%20Bike%20Extreme,%20na%20inscri%C3%A7%C3%A3o%20n%C3%BAmero:%20${paymentModel.uid}`)
        
                htmlBody = htmlBody.replace("CODIGO_PIX", paymentModel.qr_code)
        
                return authData.sendMail({
                    from: SENDER_EMAIL,
                    to:`${paymentModel.payer.email}`,
                    subject:`Pagamento Inscrição Tromba D'anta - Bike Extreme`,
                    attachDataUrls:true,
                    html:`${htmlBody}`
                })
                .then(info => {
                    console.log(info.messageId)
                    return null;
                })
                .catch(error => {
                    console.log(error)
                    return null;
                })

            });
        },(errorObject) => {
            errorObj = {code:510, message:errorObject}
            return errorObj;
        })
    }else if(paymentModel.payment_method_id == "bolbradesco"){
        var reference = db.ref("Templates/emails/"+paymentModel.payment_method_id+"/data/");
        var errorObj = {code:0, message:""};
        reference.on('value', (snapshot) => {
            var htmlBody = snapshot.val();
    
            var priceForm = new Intl.NumberFormat('pt-BR', {
                style:'currency',
                currency: "BRL",
              });
    
              var date = new Date(paymentModel.date_of_expiration);
              var yyyy = date.getFullYear();
              let mm = date.getMonth() + 1; // Months start at 0!
              let dd = date.getDate();
              
              if (dd < 10) dd = '0' + dd;
              if (mm < 10) mm = '0' + mm;
              var formattedDay = dd + '/' + mm + '/' + yyyy;
    
            htmlBody = htmlBody.replace("CONTENT_TEXT", `O seu Boleto referente à ${paymentModel.description}, no valor de `+
            `${priceForm.format(paymentModel.transaction_amount)} e data de vencimento em ${formattedDay}` +
            " já está pronto! Pague agora e risque isso da sua lista de tarefas!")
    
            htmlBody = htmlBody.replace("BOLETO_CODE",`https://api.whatsapp.com/send?phone=5538999882046&text=Ol%C3%A1,%20estou%20com%20algumas%20d%C3%BAvidas%20acerca%20do%20evento%20Tromba%20D'anta%20-%20Bike%20Extreme,%20na%20inscri%C3%A7%C3%A3o%20n%C3%BAmero:%20${paymentModel.uid}`)
            
            htmlBody = htmlBody.replace("BOLETO_LINK", paymentModel.transaction_details_url)
    
            return authData.sendMail({
                from: SENDER_EMAIL,
                to:`${paymentModel.payer.email}`,
                subject:`Pagamento Inscrição Tromba D'anta - Bike Extreme`,
                attachDataUrls:true,
                html:`${htmlBody}`
            })
            .then(info => {
                console.log(info.messageId)
                return null;
            })
            .catch(error => {
                console.log(error)
                return null;
            })
        },(errorObject) => {
            errorObj = {code:510, message:errorObject}
            return errorObj;
        })
    }else{
        var reference = db.ref("Templates/emails/credit_card/data/");
        var errorObj = {code:0, message:""};
        reference.on('value', (snapshot) => {
            var htmlBody = snapshot.val();
    
            var priceForm = new Intl.NumberFormat('pt-BR', {
                style:'currency',
                currency: "BRL",
              });
    
              var date = new Date(paymentModel.date_of_expiration);
              var yyyy = date.getFullYear();
              let mm = date.getMonth() + 1; // Months start at 0!
              let dd = date.getDate();
              
              if (dd < 10) dd = '0' + dd;
              if (mm < 10) mm = '0' + mm;
              var formattedDay = dd + '/' + mm + '/' + yyyy;
    
            htmlBody = htmlBody.replace("CONTENT_TEXT", `Pagamento referente à ${paymentModel.description}, no valor de `+
            `${priceForm.format(paymentModel.transaction_amount)} foi aprovado!`)
    
            htmlBody = htmlBody.replace("CONTATO_LINK",`https://api.whatsapp.com/send?phone=5538999882046&text=Ol%C3%A1,%20estou%20com%20algumas%20d%C3%BAvidas%20acerca%20do%20evento%20Tromba%20D'anta%20-%20Bike%20Extreme,%20na%20inscri%C3%A7%C3%A3o%20n%C3%BAmero:%20${paymentModel.uid}`)
            
    
            return authData.sendMail({
                from: SENDER_EMAIL,
                to:`${paymentModel.payer.email}`,
                subject:`Pagamento Inscrição Tromba D'anta - Bike Extreme`,
                attachDataUrls:true,
                html:`${htmlBody}`
            })
            .then(info => {
                console.log(info.messageId)
                return null;
            })
            .catch(error => {
                console.log(error)
                return null;
            })
        },(errorObject) => {
            errorObj = {code:510, message:errorObject}
            return errorObj;
        })

        var reference2 = db.ref("Templates/emails/subscription_complete/data/");
        var errorObj = {code:0, message:""};
        reference2.on('value', (snapshot) => {
            var htmlBody = snapshot.val();
                                    
            htmlBody = htmlBody.replace("CONTENT_TEXT", `Sua inscrição no Tromba D'anta - Bike Extreme foi confirmada com sucesso! Você já é um participante da competição mais emocionante do ano, fique ligado que, em breve você receberá mais atualizações sobre o percurso e novidades sobre o evento! Você também pode entrar em contato clicando no botão abaixo. Muito obrigado por fazer parte de nossa história!`)
                                    
            htmlBody = htmlBody.replace("CONTACT_LINK",`https://wa.link/9518f4`)
                                            
            return authData.sendMail({
                from: SENDER_EMAIL,
                to:`${paymentModel.payer.email}`,
                subject:`Inscrição Confirmada! Tromba D'anta Bike - Extreme`,
                attachDataUrls:true,
                html:`${htmlBody}`
            })
            .then(info => {
                console.log(info.messageId)
                return null;
            })
            .catch(error => {
                console.log(error)
                return null;
            })
        },(errorObject) => {
            errorObj = {code:510, message:errorObject}
            return errorObj;
        })
    }
})
//#endregion

//#region FUNÇÕES GERAIS DE DADOS
exports.requestData = functions.https.onRequest((request, result) => {
    cors(request, result, async () => {
        try {
            if (!request.query.path) {
                return result.status(400).json({ error: "Parâmetro 'path' ausente na requisição" });
            }

            const dataRef = db.ref(request.query.path);
            const snapshot = await dataRef.once("value");

            return result.status(200).json({
                data: snapshot.val() || null
            });
        } catch (error) {
            console.error("Erro ao acessar o banco de dados:", error);
            return result.status(500).json({ error: "Erro interno do servidor" });
        }
    });
});

exports.saveData = functions.https.onRequest((request, result) => {
    const freeAccess =
    [
        "Newsletter",
        "Newsletter/",
        "Help",
        "Help/",
        "Web/Evento/access"
    ]
    cors(request, result, () => {
        if(request.query.token == "no_token_required")
        {
            var pathAllowed = false;
            for(let i = 0; i < freeAccess.length; i++){
                if(request.query.path.startsWith(freeAccess[i])){
                    pathAllowed = true;
                    break;
                }
            }
            if(pathAllowed)
            {
                var reference = db.ref(request.query.path);
                reference.set(JSON.parse(request.query.data))
                result.send({code: 999, message:"SUCCESS"})   
            }else
            {
                result.send({error: "ACCESS DENIED",code:500, message:"Must get permission from server to access. "})
            }
        }else
        {
            var reference = db.ref("AccessToken");
            reference.on('value',(snapshot) => {
                var data = snapshot.val();
                if(data)
                {
                    var tokenSuccess = false;
                    try
                    {
                        Object.keys(data).forEach((key) => {
                            var token = data[key];
                            if(token.id == request.query.token && token.access == "full")
                            {
                                throw new Error("TokenPassed");
                            }
                        })
                        if(!tokenSuccess)
                        {
                            result.send({error: "ACCESS DENIED",code:510, message:"Invalid Token"})
                        }
                    }catch(error)
                    {
                        if(error.message === "TokenPassed"){
                            var fullAccess = db.ref(request.query.path);
                            fullAccess.set(JSON.parse(request.query.data))
                            result.send({code: 999, message:"SUCCESS"})        
                        }else{
                            result.send({error: "ACCESS DENIED",code:510, message:"Invalid Token"}) 
                        }
                        error.message === "TokenPassed"
                    }
                    
                }else
                {
                    result.send({error: "ACCESS DENIED",code:510, message:"Invalid Token"})
                }
            })
        }
    })
})

exports.deleteData = functions.https.onRequest((request, result) => {
    const freeAccess = 
    [
        "Newsletter",
        "Newsletter/"
    ]
    cors(request, result, () => {
        if(request.query.token == "no_token_required")
        {
            var pathAllowed = false;
            for(let i = 0; i < freeAccess.length; i++){
                if(request.query.path.startsWith(freeAccess[i])){
                    pathAllowed = true;
                    break;
                }
            }
            if(pathAllowed)
            {             
                var reference = db.ref(request.query.path);
                reference.remove()
                result.send({code:888, message:"Success"});  
            }else
            {
                result.send({error: "ACCESS DENIED",code:500, message:"Must get permission from server to access. "})
            }
        }else
        {
            var reference = db.ref("AccessToken");
            reference.on('value',(snapshot) => {
                var data = snapshot.val();
                if(data)
                {
                    var tokenSuccess = false;
                    try
                    {
                        Object.keys(data).forEach((key) => {
                            var token = data[key];
                            if(token.id == request.query.token && token.access == "full")
                            {
                                throw new Error("TokenPassed");
                            }
                        })
                        if(!tokenSuccess)
                        {
                            result.send({error: "ACCESS DENIED",code:510, message:"Invalid Token"})
                        }
                    }catch(error)
                    {
                        if(error.message === "TokenPassed"){
                            var fullAccess = db.ref(request.query.path);
                            fullAccess.remove()
                            result.send({code:888, message:"Success"});       
                        }else{
                            result.send({error: "ACCESS DENIED",code:510, message:"Invalid Token"}) 
                        }
                        error.message === "TokenPassed"
                    }
                    
                }else
                {
                    result.send({error: "ACCESS DENIED",code:510, message:"Invalid Token"})
                }
            })
        }
    })
});

exports.newsletter = onSchedule("00 18 * MAY-SEP 5", async (event) => {

    let authData = nodemailer.createTransport({
        host:'smtp.gmail.com',
        port:465,
        secure:true,
        auth:{
            user:SENDER_EMAIL,
            pass:SENDER_PASSWORD
        }
    });

    var inscritosRef = db.ref("Participantes/");
    inscritosRefonce('value').then((snapshot) => {
        var data = snapshot.val();
        if(data)
        {
            try
            {
                var index = 0
                var dataArray = Object.values(data);
                for(let i = 0; i < dataArray.length; i++)
                {
                    var user = dataArray[i];
                    var newsletterModel = 
                    {
                        email:user.email,
                        timestamp:(Date.now() + index)
                    }
                    index++;
                    var newsletterRef = db.ref("Newsletter/"+newsletterModel.timestamp);
                    newsletterRef.set(newsletterModel);
                }
            }catch(error)
            {
                console.log(error.message);
            }
        }
        else {console.log("NO_USER_DATA_FOUND")}
    },(errorObject) => {
        result.send(errorObject);
    })

    var reference = db.ref("Newsletter/");
    reference.on('value', (snapshot) => {
        snapshot.forEach((element) => {
            var newsletterModel = element.val();
            var emailRef = db.ref("Templates/emails/newsletter_normal/data/");
            emailRef.on('value', (snapshot) => {
                try
                {
                    var htmlBody = snapshot.val();
                
                    htmlBody = htmlBody.replace("CONTENT_TEXT", 
                    `
                    Caros participantes do Tromba D'anta Bike Extreme, Gostaríamos de compartilhar uma 
                    importante atualização sobre o evento. <b>Devido à inesperada saída da empresa organizadora anterior</b>, 
                    estamos trabalhando arduamente para garantir a continuação do Tromba D'anta Bike Extreme. 
                    Nesse processo estamos trabalhando para realizar a liberação da nova data até dia 05/09.
                    <br>
                    Reconhecemos que essa mudança pode afetar seus planos, e pedimos desculpas por qualquer inconveniente 
                    que isso possa causar. Estamos comprometidos em assegurar que o evento seja um sucesso, 
                    digno da sua empolgação e apoio contínuo. Agradecemos pela sua paciência e compreensão 
                    enquanto trabalhamos para criar uma experiência excepcional no Tromba D'anta Bike Extreme em sua nova data.
                    <br>
                    Agradecemos pela sua paciência e compreensão enquanto trabalhamos para criar uma experiência excepcional 
                    no Tromba D'anta Bike Extreme em sua nova data.
                    `)
                    
                    htmlBody = htmlBody.replace("SUB_LINK", "https://bike-extreme.com/comunicado");
        
                    htmlBody = htmlBody.replace("CANCEL_NEWSLETTER", `https://bike-extreme.com/quit-newsletter.html?${newsletterModel.timestamp}`)
                    
                    return authData.sendMail({
                        from: SENDER_EMAIL,
                        to:`${newsletterModel.email}`,
                        subject:`Venha Fazer Parte do Tromba D'anta Bike - Extreme!`,
                        attachDataUrls:true,
                        html:`${htmlBody}`
                    })
                    .then(info => {
                        console.log(info.messageId)
                        return null;
                    })
                    .catch(error => {
                        console.log(error)
                        return null;
                    })
                }catch(err){
                    console.log(err.message)
                }
    
            })
        });
    },(errorObject) => {
        result.send(errorObject);
    })
});

exports.getFridayUser = functions.https.onRequest(async (req, res) => {
    try {
        // Obtém o número de telefone da query string (ex: ?phone=+55XXXXXXXXX)
        const phone = req.query.phone;

        if (!phone) {
            return res.status(400).json({ error: "Número de telefone é obrigatório." });
        }

        // Busca no banco de dados onde o telefone corresponde ao usuário
        const snapshot = await db.ref("Users").orderByChild("phone").equalTo(phone).once("value");

        // Se o usuário não existir
        if (!snapshot.exists()) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        let userData;
        snapshot.forEach((child) => {
            userData = child.val();
        });

        // Retorna os dados do usuário se for autorizado
        return res.status(200).json({
            message: "Usuário encontrado",
            user: userData
        });

    } catch (error) {
        console.error("Erro ao verificar usuário:", error);
        return res.status(500).json({ error: "Erro interno do servidor" });
    }
})
//#endregion

//#region PROCESSA PAGAMENTOS REALIZADOS
exports.mercadoPagoRequest = functions.https.onRequest((request, result) => {
    cors(request, result, () => {      
        mercadopago.configurations.setAccessToken(MERCADO_PAGO_ACCESS_TOKEN);

        let authData = nodemailer.createTransport({
            host:'smtp.gmail.com',
            port:465,
            secure:true,
            auth:{
                user:SENDER_EMAIL,
                pass:SENDER_PASSWORD
            }
        });

        try{
            if(request.body.action == "payment.updated")
            {
                var receivedPayment = request.body.data;
                var paymentRef = db.ref("Pagamentos/");
                paymentRef.on('value', (snapshot) => {
                    snapshot.forEach((paymentModel) => {
                        if(paymentModel.val().paymentID == receivedPayment.id)
                        {
                            mercadopago.payment.get(receivedPayment.id).then(function (data) {
                                console.log({items: JSON.stringify(data)})
                                if(data.body.status == "approved")
                                {
                                    try{
                                        var saveReference = db.ref(`Participantes/${paymentModel.val().uid}/confirmation/`);
                                        saveReference.set(JSON.parse(true))

                                        try{
                                            var savePaymentReference = db.ref(`Pagamentos/${paymentModel.val().uid}/status/`);
                                            savePaymentReference.set("approved")
                                        }catch(errPayment){
                                            console.log("ERRO WHILE CHANGING PAYMENT STATUS")
                                            console.log(errPayment.message);
                                        }

                                        var reference = db.ref("Templates/emails/subscription_complete/data/");
                                        var errorObj = {code:0, message:""};
                                        reference.on('value', (snapshot) => {
                                            var htmlBody = snapshot.val();
                                    
                                            htmlBody = htmlBody.replace("CONTENT_TEXT", `<br>Sua inscrição no Tromba D'anta - Bike Extreme foi confirmada com sucesso! Você já é um participante da competição mais emocionante do ano, fique ligado que, em breve você receberá mais atualizações sobre o percurso e novidades sobre o evento! <br><br>Você também pode entrar em contato clicando no botão abaixo. Muito obrigado por fazer parte de nossa história!`)
                                    
                                            htmlBody = htmlBody.replace("CONTACT_LINK",`https://wa.link/9518f4`)
                                            
                                            return authData.sendMail({
                                                from: SENDER_EMAIL,
                                                to:`${paymentModel.val().payer.email}`,
                                                subject:`Inscrição Confirmada! Tromba D'anta Bike - Extreme`,
                                                attachDataUrls:true,
                                                html:`${htmlBody}`
                                            })
                                            .then(info => {
                                                console.log(info.messageId)
                                                return null;
                                            })
                                            .catch(error => {
                                                console.log(error)
                                                return null;
                                            })
                                        },(errorObject) => {
                                            errorObj = {code:510, message:errorObject}
                                            return errorObj;
                                        })
                                    }catch(emailError){
                                        console.log(emailError.message);
                                    }    
                                }else{
                                    var reference = db.ref("PaymentRequestErrors/"+Date.now().toString());
                                    reference.set(data)
                                }
                            }).catch(function (err) {
                                console.log(err.message)
                            });
                        }
                    })
                },(errorObject) => {
                    return(errorObject);
                })
            }
        }
        catch(err){
            try{
                var reference = db.ref("PaymentRequestErrors/"+Date.now().toString());
                reference.set(request.body)
            }
            catch(err){
                console.log("Critical error while saving data.")
                console.log(err.message)
            }  
        }

        result.status(200).send("Successfull request");

    });
})
//#endregion

//#region REDIRECIONAMENTO DE PAGINAS

// Mapeamento de URLs para redirecionamento
const redirects = {
    '/Percursos/Extreme': '/percursos?extreme',
    '/percursos/extreme': '/percursos?extreme',
    '/Percursos/Light': '/percursos?light',
    '/percursos/light': '/percursos?light',
    '/Percursos/Passeio': '/percursos?passeio',
    '/percursos/passeio': '/percursos?passeio',
    '/Percursos/Kids': '/percursos?kids',
    '/percursos/kids': '/percursos?kids',
    '/Percursos/trail-light': '/percursos?trail-light',
    '/percursos/trail-light': '/percursos?trail-light',
    '/Percursos/trail-extreme': '/percursos?trail-extreme',
    '/percursos/trail-extreme': '/percursos?trail-extreme',
    '/nossos-percursos': '/#categories-section',

    '/Inscricao/Extreme': '/cadastro?extreme',
    '/inscricao/extreme': '/cadastro?extreme',
    '/Inscricao/Light': '/cadastro?light',
    '/inscricao/light': '/cadastro?light',
    '/Inscricao/Passeio': '/cadastro?passeio',
    '/inscricao/passeio': '/cadastro?passeio',
    '/Inscricao/Kids': '/cadastro?kids',
    '/inscricao/kids': '/cadastro?kids',
    '/Inscricao/trail-light': '/cadastro?trail-light',
    '/inscricao/trail-light': '/cadastro?trail-light',
    '/Inscricao/trail-extreme': '/cadastro?trail-extreme',
    '/inscricao/trail-extreme': '/cadastro?trail-extreme',

    '/Comunicado': '/#comunicado',
    '/comunicado': '/#comunicado',
    '/Data': '/#comunicado',
    '/data': '/#comunicado',
    '/quando-vai-acontecer': '/#comunicado',
    '/fale-conosco': '/#fale-conosco',
    '/local': '/#localizacao',
    '/onde-vai-ser': '/#localizacao',
    '/premios': '/#premios',

    '/admin': '/admin/login',
    '/admin/': '/admin/login'
  };
  
  // Função para redirecionar URLs
  app.use((req, res, next) => {
    const originalUrl = req.originalUrl;
    const redirectUrl = redirects[originalUrl];
  
    if (redirectUrl) {
      res.redirect(301, redirectUrl);
    } else {
      next();
    }
  });
  
  // Função para lidar com solicitações não redirecionadas
  app.use((req, res) => {
    res.redirect(301, "https://bike-extreme.com")
    res.status(404).send('Página não encontrada');
  });
  
  // Exportar a função como um endpoint HTTPS
  exports.redirects = functions.https.onRequest(app);

//#endregion

//#region WHATSAPP BOT

//#endregion

//#region ADMIN FUNCTIONS
exports.loginUser = functions.https.onRequest((request, result) => {
    cors(request, result, () => {
        if(request.query.user != null)
        {
            var loginUser = JSON.parse(request.query.user);
            console.log(loginUser)
            var reference = db.ref("Admin/Users/");
            reference.on('value', (snapshot) => {
                var data = snapshot.val();
                console.log(data);
                if(data)
                {
                    console.log("HAS DATA")
                    try
                    {
                        var userSuccess = false;
                        var dataArray = Object.values(data);
                        for(let i = 0; i < dataArray.length; i++)
                        {
                            var user = dataArray[i];
                            console.log("PROCESSING:")
                            console.log(user)
                            
                            if(user.login.userName == loginUser.userName && user.login.password == loginUser.password)
                            {
                                userSuccess = true;
                                result.send({code: 999, token: user.login.token, uid: user.uid, message:"Login Successfully"});
                                break;
                            }
                        }
                        if(userSuccess == false)
                        {
                            result.send({code: 111, message:"Login ou senha incorretos"});
                        }
                    }catch(error)
                    {
                        console.log(error.message)
                    }
                }else
                {
                    result.send({code: 510, message: "Usuário não encontrado"})
                }

            },(errorObject) => {
                result.send(errorObject);
            })

        }else
        {
            result.send({code: 500, message: "Usuário não definido"})
        }
    })
})
//#endregion