import * as functions from 'firebase-functions';
import admin = require('firebase-admin');
import apiPagamentos from './apiPagamentos';

admin.initializeApp();
const db = admin.firestore();

const porcentagem_more = 10; // MORE -> recebe 10% do valor total do pagamento
const porcentagem_destino = 90; // prestador do serviço -> recebe 90% do valor total do pagamento

const mensagens_pagamentos = ['Compra de crédito', 'Assinatura']

const payment = new apiPagamentos(porcentagem_more, porcentagem_destino);
const auth = payment.oauthToken();

export const saldo_juno = functions.https.onRequest(async (req, res) => {
    await auth.then((authdata:any) => {
        const Atoken = authdata.access_token;
        const saldo = payment.saldo(Atoken);
        saldo.then(async (datares:any) => {
            await db.collection("saldo").add({ detalhes: datares.data })
            .then(() => {
                res.status(200).json({
                    success: true,
                    data: datares.data,
                    message: "saldo em conta"
                })
            })
            .catch((err:any) => {
                res.status(500).json({
                    success: false,
                    data: [],
                    message: err
                })
            });
        })
        .catch((err:any) => {
            res.status(400).json({
                success: false,
                data: [],
                message: err.response.data
            })
        });
    })
    .catch((err:any) => {
        res.status(400).json({
            success: false,
            data: [],
            message: "Não foi possível autenticar"
        })
    })
});


// compra crédito
export const cobranca_juno = functions.https.onRequest(async (req, res) => {
    const 
        hashCreditCard  = req.query.hashCreditCard,
        dadosCobranca = {
            descricao: mensagens_pagamentos[0],
            valor_cobranca: 221.50,
            recipient_token_destino: '397F1B7B722DE52E88D68D8D3E16C5A45A376016E099F5093D79D83629DE8135',// destino do pagamento, prestador do serviço, quem vai receber o valor
            nome_comprador: 'ronaldo freitas da cunha',// nome da pessoa ou empresa
            documento_comprador: '91265426090',// CPF ou CNPJ
            tipo_pagamento: ['CREDIT_CARD']// ["CREDIT_CARD"], ["CREDIT_CARD", "BOLETO"] ou ["BOLETO"]
        },
        endereco = {
            street: "rua monte castelo",
            number: "1",
            city: "Salvador",
            state: "BA",
            postCode: "40301210",
        },
        email = 'ronafreitasweb@gmail.com';

    await auth.then(async (datares:any) => {
        const Atoken = datares.access_token;
        const tokenizarCartao = payment.tokenizarCartao(hashCreditCard, Atoken);
        await tokenizarCartao.then(async (resT:any) => {
            const creditCardId = resT.data.creditCardId;
            const criarCobrancaComSplit = payment.criarCobrancaComSplit(dadosCobranca, Atoken);
            await criarCobrancaComSplit.then(async (resC:any) => {
                const chargeId = resC.data._embedded.charges[0].id;
                const criarPagamentoDeCobranca = payment.criarPagamentoDeCobranca(chargeId, endereco, creditCardId, email, Atoken);
                await criarPagamentoDeCobranca.then((resP:any) => {
                    const reslt = {
                        chargeId,
                        payments_id: resP.data.payments[0].id
                    };
                    res.status(200).json({
                        success: true,
                        data: reslt,
                        message: "cobrança realizada"
                    })
                })
                .catch((erP:any) => {
                    res.status(400).json({
                        success: false,
                        data: [],
                        message: erP.response.data
                    })
                });
            })
            .catch((erC:any) => {
                res.status(400).json({
                    success: false,
                    data: [],
                    message: erC.response.data
                })
            });
        })
        .catch((erT:any) => {
            res.status(400).json({
                success: false,
                data: [],
                message: erT.response.data
            })
        });
    })
    .catch((err:any) => {
        res.status(500).json({
            success: false,
            data: [],
            message: "Não foi possível autenticar"
        })
    })
});

// 
export const capturar_juno = functions.https.onRequest(async (req, res) => {
    /*
    const
        chargeId = 'chr_BB4525F9131AD8662A63BF699C06D449',
        payments_id = 'pay_13A171B639DFC734';
    */

    const
        chargeId = req.query.chargeId,
        payments_id = req.query.payments_id;

    await auth.then(async (authdata:any) => {
        const Atoken = authdata.access_token;
        const capturar = payment.capturarPagamento(chargeId, payments_id, Atoken);
        capturar.then(async (datares:any) => {
            await db.collection("pagamentos").add({ detalhes: datares.data })
            .then(() => {
                res.status(200).json({
                    success: true,
                    data: datares.data,
                    message: "pagamento capturado"
                })
            })
            .catch((err:any) => {
                res.status(500).json({
                    success: false,
                    data: [],
                    message: err.response.data
                })
            });
        })
        .catch((err:any) => {
            res.status(400).json({
                success: false,
                data: [],
                message: err.response.data
            })
        })
    })
    .catch((err:any) => {
        res.status(500).json({
            success: false,
            data: [],
            message: "Não foi possível autenticar"
        })
    })
});