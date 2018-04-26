const TelegramBot = require('node-telegram-bot-api');
const config = require('config');
const dateFormat = require('dateformat');
const axios = require('axios');

const token = config.get("token");
const channel = config.get("channel");
const admin = config.get("admin");
const google = config.get("googleToken");

const port = process.env.PORT || config.get('port');
const host = process.env.HOST || '0.0.0.0';
const url = process.env.WEBHOOK_URL || config.get('url');

const bot = new TelegramBot(token, {
    webHook: {
        port: port,
        host: host
    }
});

bot.setWebHook(url + ':443/bot' + token);


const dist = {};
const loc1 = {};
const loc2 = {};


bot.onText(/\/start/, msg => {
    bot.sendMessage(msg.chat.id, "Добро пожаловать", {
        reply_markup: {
            keyboard: [
                [
                    {
                        text: "Узнать расстояние"
                    }
                ]
            ],
            resize_keyboard: true
        }
    })
});

bot.onText(/Узнать расстояние/, msg => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Отправьте первую локацию", {
        reply_markup: {
            keyboard: [
                [
                    {
                        text: "Отменить"
                    }
                ]
            ],
            resize_keyboard: true
        }
    });
    dist[chatId] = {key: "location1", from: msg.from.id}

});

bot.on('location', async msg => {

    const chatId = msg.chat.id;

    if(chatId in dist && dist[chatId].key === "location1") {
        loc1[chatId] = {from: msg.from.id, lat: msg.location.latitude, lon: msg.location.longitude};
        dist[chatId].key = "location2";
        bot.sendMessage(chatId, "Отправьте вторую локацию");
        return
    }

    if(chatId in dist && dist[chatId].key === "location2") {
        loc2[chatId] = {from: msg.from.id, lat: msg.location.latitude, lon: msg.location.longitude};
        dist[chatId].key = "location2";

        try {
            const distance = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json?origins=' + loc1[chatId].lat + ',' + loc1[chatId].lon + '&destinations=' + loc2[chatId].lat + ',' + loc2[chatId].lon + '&key=' + google);

            const message = '<b>Начальный адрес:</b>' + '\n' + distance.data.origin_addresses[0] + '\n\n'
                + '<b>Пункт назначения:</b>' + '\n' + distance.data.destination_addresses[0] + '\n\n'
                + '<b>Примерное расстояние:</b>' + '\n' + distance.data.rows[0].elements[0].distance.text + '\n\n'
                + '<b>Приблизительное время в пути:</b>' + '\n' + distance.data.rows[0].elements[0].duration.text + '\n\n'
                + '<a href="https://www.google.com/maps/dir/'+loc1[chatId].lat+','+loc1[chatId].lon+'/'+loc2[chatId].lat+','+loc2[chatId].lon+'?nogmmr=1?">Посмотреть маршрут</a>';

            const message2 = '<b>Запрашивали расстояние:\n\n от:</b>' + '\n' + distance.data.origin_addresses[0] + '\n\n'
                + '<b>до:</b>' + '\n' + distance.data.destination_addresses[0] + '\n\n';

            bot.sendMessage(chatId, message, {
                parse_mode: "HTML",
                disable_web_page_preview: true,
                reply_markup: {
                    keyboard: [
                        [
                            {
                                text: "Узнать расстояние"
                            }
                        ]
                    ],
                    resize_keyboard: true
                }
            }).then( next =>{
                bot.sendMessage(channel, message2, {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "Подробнее",
                                    callback_data: "details_"+next.chat.id+"_"+next.message_id
                                }
                            ]
                        ]
                    }
                })
            })




        } catch (err) {
            bot.sendMessage(chatId, "Не удалось определить расстояние", {
                reply_markup: {
                    keyboard: [
                        [
                            {
                                text: "Узнать расстояние"
                            }
                        ]
                    ],
                    resize_keyboard: true
                }
            });
            console.log(err)
        }
        delete dist[chatId];
        delete loc1[chatId];
        delete loc2[chatId];
        return;
    }
});

bot.onText(/Отменить/, msg => {
    chatId = msg.chat.id;
    delete dist[chatId];
    delete loc1[chatId];
    delete loc2[chatId];
    bot.sendMessage(msg.chat.id, "Запрос отменен", {
        reply_markup: {
            keyboard: [
                [
                    {
                        text: "Узнать расстояние"
                    }
                ]
            ],
            resize_keyboard: true
        }
    })
});


bot.on('callback_query', query => {

    const data = query.data.split("_");

    if(data[0] === "details") {
        bot.forwardMessage(query.from.id, data[1], data[2]);
        bot.editMessageText(query.message.text + '\n\nЗапрос закрыт', {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id
        })
        bot.answerCallbackQuery(query.id);
        return;
    }

});


bot.onText(/\/addMe/, msg => {
    const chatId = msg.chat.id;
    try {
        bot.getChatMember(channel, chatId)
            .then(data => {
                if(data.status === "kicked") {
                    bot.unbanChatMember(channel, chatId)
                } else if (data.status === "member") {
                    bot.sendMessage(chatId, "Вы уже подписаны на канал");
                    return;
                } else if (data.status === "administrator") {
                    bot.sendMessage(chatId, "Вы администратор канала");
                    return;
                } else if (data.status === "creator") {
                    bot.sendMessage(chatId, "Вы создатель канала");
                    return;
                }


                bot.sendMessage(chatId, "⬇️ Чтобы подписатсья на канал нажмите на кнопку ⬇️", {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "Присоединиться к каналу",
                                    url: config.get("invite")
                                }
                            ]
                        ]
                    }
                })
            })

    } catch (err) {

        bot.sendMessage(chatId, "⬇️ Чтобы подписатсья на канал нажмите на кнопку ⬇️", {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "Присоединиться к каналу",
                            url: config.get("invite")
                        }
                    ]
                ]
            }
        })
    }
})