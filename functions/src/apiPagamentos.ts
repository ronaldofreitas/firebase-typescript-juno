import axios, {AxiosPromise} from 'axios';

export interface Address {
    street: string;
    number: string;
    city: string;
    state: string;
    postCode: string;
}

export interface Charge {
    descricao: string;
    valor_cobranca: number;
    recipient_token_destino: string;
    nome_comprador: string;
    documento_comprador: string;
    tipo_pagamento: Array<string>;
}

export default class apiPagamentos {

    url_base_pay:string;
    X_Api_Version:number;
    X_Resource_Token_More:string;
    Basic_Auth:string;
    porcentagem_more:number;
    porcentagem_destino:number;

    constructor(porcentagem_more:number, porcentagem_destino:number) {
        this.url_base_pay = 'https://sandbox.boletobancario.com';
        this.X_Resource_Token_More = '';
        this.Basic_Auth = '';
        this.X_Api_Version = 2;

        this.porcentagem_more = porcentagem_more; // MORE -> recebe 10% do valor total do pagamento
        this.porcentagem_destino = porcentagem_destino; // prestador do serviço -> recebe 90% do valor total do pagamento
    }

    async oauthToken() {
        const config = {
            headers: {
                'Authorization': `Basic ${this.Basic_Auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
        return await axios.post(`${this.url_base_pay}/authorization-server/oauth/token`, 'grant_type=client_credentials', config)
        .then((ret) => {
            return ret.data
        })
        .catch((error) => {
            //return error.response.data.details
            return error
        })
    }

    setHeaders(token: string) {
        const config = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Api-Version': this.X_Api_Version,
                'X-Resource-Token': this.X_Resource_Token_More,
                'Content-Type': `application/json;charset=UTF-8`,
            }
        }
        return config;
    }

    async criarCobrancaComSplit(dadosCobranca:Charge, Access_Token:string): Promise<AxiosPromise> {
        const recipientToken_more = this.X_Resource_Token_More;
        const postData = {
            charge: {
                description: dadosCobranca.descricao,
                amount: dadosCobranca.valor_cobranca,
                paymentTypes: dadosCobranca.tipo_pagamento,
                split: [
                    {
                        recipientToken: recipientToken_more,
                        percentage: this.porcentagem_more,
                        amountRemainder: false,
                        chargeFee: true // se for true, indica que este pagará taxa da Juno
                    },
                    {
                        recipientToken: dadosCobranca.recipient_token_destino,
                        percentage: this.porcentagem_destino,
                        amountRemainder: true,// se for true, indica que recebe o 'restante' do valor total
                        chargeFee: false
                    }
                ]
            },
            billing: {
                name: dadosCobranca.nome_comprador,
                document: dadosCobranca.documento_comprador
            }
        };
        return await axios.post(`${this.url_base_pay}/api-integration/charges`, postData, this.setHeaders(Access_Token));
    }

    async inserirCreditosBoleto(dadosCobranca:any, Access_Token:string): Promise<AxiosPromise> {
        const postData = {
            charge: {
                description: dadosCobranca.descricao,
                amount: dadosCobranca.valor_cobranca,
                paymentTypes: dadosCobranca.tipo_pagamento,
                dueDate: dadosCobranca.data_vencimento
            },
            billing: {
                name: dadosCobranca.nome_comprador,
                document: dadosCobranca.documento_comprador
            }
        };
        return await axios.post(`${this.url_base_pay}/api-integration/charges`, postData, this.setHeaders(Access_Token));
    }

    /*
    confirmação de pagamento via notificação

    1) criar webhook
    https://dev.juno.com.br/api/v2#operation/createWebhook

    2) PAYMENT_NOTIFICATION
    https://dev.juno.com.br/api/v2#tag/Notificacoes

    */
    async criarWebhooks(url:string, event_types: Array<string>, Access_Token: string): Promise<AxiosPromise> {
        const postData = {
            url,
            eventTypes: event_types
        };
        return await axios.post(`${this.url_base_pay}/api-integration/notifications/webhooks`, postData, this.setHeaders(Access_Token));
    }

    async deletaWebhooks(id_webhook:any, Access_Token: string): Promise<AxiosPromise> {
        return await axios.delete(`${this.url_base_pay}/api-integration/notifications/webhooks/${id_webhook}`, this.setHeaders(Access_Token));
    }

    async criarCobrancaDiretaMore(dadosCobranca:any, Access_Token:string): Promise<AxiosPromise> {
        const postData = {
            charge: {
                description: dadosCobranca.descricao,
                amount: dadosCobranca.valor_cobranca,
                paymentTypes: dadosCobranca.tipo_pagamento
            },
            billing: {
                name: dadosCobranca.nome_comprador,
                document: dadosCobranca.documento_comprador
            }
        };
        return await axios.post(`${this.url_base_pay}/api-integration/charges`, postData, this.setHeaders(Access_Token));
    }

    async tokenizarCartao(creditCardHash:any, Access_Token:string): Promise<AxiosPromise> {
        const postData = {
            "creditCardHash": creditCardHash
        }
        return await axios.post(`${this.url_base_pay}/api-integration/credit-cards/tokenization`, postData, this.setHeaders(Access_Token));
    }

    async criarPagamentoDeCobrancaMore(chargeId:string, address:Address, creditCardId:any, email:string, Access_Token:string): Promise<AxiosPromise> {
        const postData = {
            chargeId,
            billing:{
                email,
                address: address,
                delayed: false// se true, o valor do destino do prestador do serviço fica retido até a captura do pagamento (capturarPagamento)
            },
            creditCardDetails: {creditCardId}
        };
        return await axios.post(`${this.url_base_pay}/api-integration/payments`, postData, this.setHeaders(Access_Token));
    }

    async criarPagamentoDeCobranca(chargeId:string, address:Address, creditCardId:string, email:string, Access_Token:string): Promise<AxiosPromise> {
        const postData = {
            chargeId,
            billing:{
                email,
                address: address,
                delayed: true// se true, o valor do destino do prestador do serviço fica retido até a captura do pagamento (capturarPagamento)
            },
            creditCardDetails: {creditCardId}
        };
        return await axios.post(`${this.url_base_pay}/api-integration/payments`, postData, this.setHeaders(Access_Token));
    }

    async capturarPagamento(chargeId:any, paymentId:any, Access_Token:string): Promise<AxiosPromise> {
        const postData = {chargeId};
        return await axios.post(`${this.url_base_pay}/api-integration/payments/${paymentId}/capture`, postData, this.setHeaders(Access_Token));
    }

    async saldo(Access_Token:string): Promise<AxiosPromise> {
        return await axios.get(`${this.url_base_pay}/api-integration/balance`, this.setHeaders(Access_Token));
    }
}