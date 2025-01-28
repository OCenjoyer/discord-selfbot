const { Client, MessageEmbed } = require('discord.js-selfbot-v13');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { exec } = require('child_process');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const client = new Client();
const token = config.token;

let loggingActive = true;
let antiGroupActive = true;
let linkBypassActive = true;
let afkActive = false;
let busyActive = false;
let offlineActive = false;

async function getIpLocation(ip) {
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}`);
        const data = await response.json();
        
        if (data.status === "fail") {
            return null;
        }

        return {
            ip: ip,
            country: data.country,
            city: data.city,
            region: data.regionName,
            isp: data.isp
        };
    } catch (error) {
        console.error('IP lookup error:', error);
        return null;
    }
}

const convert = (from, to) => str => Buffer.from(str, from).toString(to);
const utf8ToHex = convert('utf8', 'hex');
const addPercentBetweenHex = (hexString) => {
    const hexArray = hexString.match(/.{1,2}/g);
    return hexArray.join('%');
};

function processLink(link) {
    const slashIndex = link.indexOf('/') + 1;
    let path = '';
    if (slashIndex == 0 || link[6] != '/') {
        path = link;
    } else {
        path = link.substring(8);
    }
    const asciiToHex = addPercentBetweenHex(utf8ToHex(path)).replace('%2f', '/');
    return `<ht\ntp\ns:/\\%${asciiToHex}>`;
}

async function num_info(phoneNumber) {
    const apiKey = "ecf9bab247ff6e9c630c9abde4f18f7d"; 
    const url = `http://apilayer.net/api/validate?access_key=${apiKey}&number=${phoneNumber}&format=1`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.valid) {
            const country = data.country_name;
            const location = data.location;
            const carrier = data.carrier;
            const lineType = data.line_type;

            return `**Phone Number Information:**\n` +
                   `🌍 **Country:** ${country}\n` +
                   `📍 **Location:** ${location}\n` +
                   `📞 **Carrier:** ${carrier}\n` +
                   `📱 **Line Type:** ${lineType}`;
        } else {
            return "❌ Invalid phone number.";
        }
    } catch (error) {
        console.error('Error fetching phone number info:', error);
        return "❌ An error occurred while fetching phone number information.";
    }
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    setInterval(async () => {
        if (antiGroupActive) {
            client.channels.cache.forEach(async (channel) => {
                if (channel.type == 'GROUP_DM') {
                    try {
                        await channel.send('❌ No group without permission! ❌');
                        await channel.delete();
                    } catch (error) {
                        console.error('Anti-group error:', error);
                    }
                }
            });
        }
    }, 2000);
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (loggingActive && newMessage.content !== oldMessage.content) {
        const logData = {
            oldContent: oldMessage.content || 'No content',
            newContent: newMessage.content || 'No content',
            author: newMessage.author.tag,
            avatar: newMessage.author.displayAvatarURL(),
            timestamp: newMessage.editedTimestamp || newMessage.createdAt,
            serverId: newMessage.guild ? newMessage.guild.id : 'N/A',
            serverName: newMessage.guild ? newMessage.guild.name : 'Private Messages'
        };

        const embed = new MessageEmbed()
            .setColor('#000000')
            .setTitle('Message Edited')
            .setAuthor({ name: logData.author, iconURL: logData.avatar })
            .addFields(
                { name: 'Server', value: `${logData.serverName} (${logData.serverId})`, inline: false },
                { name: 'Old Content', value: logData.oldContent, inline: true },
                { name: 'New Content', value: logData.newContent, inline: true }
            )
            .setTimestamp(logData.timestamp);

        try {
            await fetch(config.webhookUrl, {
                method: 'POST',
                body: JSON.stringify({ embeds: [embed] }),
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            console.error('Error sending log to webhook:', error);
        }
    }
});

client.on('messageDelete', async (message) => {
    if (loggingActive && message.content) {
        const logData = {
            content: message.content,
            author: message.author.tag,
            avatar: message.author.displayAvatarURL(),
            timestamp: message.createdAt,
            serverId: message.guild ? message.guild.id : 'N/A',
            serverName: message.guild ? message.guild.name : 'Private Messages'
        };

        const embed = new MessageEmbed()
            .setColor('#000000')
            .setTitle('Message Deleted')
            .setAuthor({ name: logData.author, iconURL: logData.avatar })
            .addFields(
                { name: 'Server', value: `${logData.serverName} (${logData.serverId})`, inline: false },
                { name: 'Content', value: logData.content, inline: true }
            )
            .setTimestamp(logData.timestamp);

        try {
            await fetch(config.webhookUrl, {
                method: 'POST',
                body: JSON.stringify({ embeds: [embed] }),
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            console.error('Error sending log to webhook:', error);
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.content === '+cmd') {
        const helpText = `**<:terminal:1309713594128273449> Command List**\n\nHere are the commands you can use with the 2rich tool:\n\n` +
            `<:logs:1309713282432765972> \`+log <on/off>\` - Enable or disable message logging.\n\n` +
            `<:trash:1309699732997935124> \`+purge <amount>\` - Delete the specified number of messages in the current channel.\n\n` +
            `<:location:1309699495289819222> \`+ geo <IP>\` - Get geolocation information for the specified IP address.\n\n` +
            `<:website:1303489875168727093> \`+ping <IP/URL>\` - Ping an IP address or URL.\n\n` +
            `<:friend:1309698580935868416> \`+antigroup <on/off>\` - Allow or prevent users from adding me to group DMs. Use 'on' to restrict and 'off' to allow.\n\n` +
            `<:website:1303489875168727093> \`+socials\` - Display social media links.\n\n` +
            `<:sigmaping:1303490888047267903> \`+afk <on/off>\` - Enable or disable AFK mode.\n\n` +
            `<:busy:1309709146886770739> \`+busy <on/off>\` - Enable or disable busy mode.\n\n` +
            `<:cross:1303488940694831125> \`+offline <on/off>\` - Enable or disable offline mode.\n\n` +
            `<:call:1309713004207800434> \`+phone <number>\` - Get information about the specified phone number.\n\n` +
            `<:sqlmap:1311124549211000926> \`+sql <link>\` - Checks all vulnerabilities about the specified url.\n\n` +
            `<:star:1303488612394074112> \`+cmd\` - Show this help message with all available commands.\n\n`;           

        await message.reply(helpText);
    }

    if (message.content.startsWith('+log')) {
        try {
            const args = message.content.split(' ');
            if (args.length === 1) {
                await message.reply('Please specify "on" or "off".');
                return;
            }
            
            if (args[1] === 'on') {
                if (loggingActive) {
                    await message.reply('Logging is already active.');
                } else {
                    loggingActive = true;
                    await message.reply('Logging enabled.');
                    console.log(`[LOG] Logging enabled by ${message.author.tag}`);
                    
                    await fetch(config.webhookUrl, {
                        method: 'POST',
                        body: JSON.stringify({ 
                            content: `🔔 Logging enabled by ${message.author.tag}` 
                        }),
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
            } else if (args[1] === 'off') {
                if (!loggingActive) {
                    await message.reply('Logging is already disabled.');
                } else {
                    loggingActive = false;
                    await message.reply('Logging disabled.');
                    console.log(`[LOG] Logging disabled by ${message.author.tag}`);
                    
                    await fetch(config.webhookUrl, {
                        method: 'POST',
                        body: JSON.stringify({ 
                            content: `🔕 Logging disabled by ${message.author.tag}` 
                        }),
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
            } else {
                await message.reply('Invalid option. Please specify "on" or "off".');
            }
        } catch (error) {
            console.error('Log command error:', error);
            await message.reply('❌ An error occurred while managing logging.');
        }
    }

    if (message.content.startsWith('+ping')) {
        const args = message.content.split(' ');
        
        if (args.length !== 2) {
            await message.reply('❌ Please specify a valid IP or URL.');
            return;
        }

        const target = args[1];
        console.log(`[PING] Command executed: +ping ${target} by ${message.author.tag}`);

        exec(`ping ${target}`, async (error, stdout, stderr) => {
            try {
                if (error) {
                    console.error(`[PING] Error: ${error}`);
                    await message.reply('❌ Error executing ping command.');
                    return;
                }

                const pingResult = `📡 **Ping Results for ${target}**\n\`\`\`\n${stdout}\`\`\``;
                await message.reply(pingResult);

                if (loggingActive) {
                    await fetch(config.webhookUrl, {
                        method: 'POST',
                        body: JSON.stringify({
                            content: `🔍 Ping command executed by ${message.author.tag}\nTarget: ${target}\nServer: ${message.guild ? message.guild.name : 'Private Messages'}`
                        }),
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
            } catch (replyError) {
                console.error('[PING] Reply error:', replyError);
                await message.reply('❌ An error occurred while sending ping results.');
            }
        });
    }

    if (message.content.startsWith('+sql')) {
        const args = message.content.split(' ');
    
        if (args.length !== 2) {
            await message.reply('❌ Please provide a valid URL to scan for SQL vulnerabilities.');
            return;
        }
    
        const url = args[1];
        console.log(`Command executed: +sql ${url} by ${message.author.tag}`);
    
        exec(`python C:\\Users\\‎\\Desktop\\self\\sqlmap\\sqlmap.py -u "${url}" --batch --level=2 --risk=2`, async (error, stdout, stderr) => {
            if (error) {
                console.error(`SQL scan error: ${error}`);
                await message.reply('❌ An error occurred while scanning for vulnerabilities.');
                return;
            }
    
            if (stderr) {
                console.error(`SQL scan stderr: ${stderr}`);
                await message.reply(`❌ Error in SQL scan: ${stderr}`);
                return;
            }
    
            console.log(`SQL scan stdout: ${stdout}`);
    
            const result = stdout || 'No output from the scan.';
            await message.reply(`<:sqlmap:1311124549211000926> **SQL Vulnerability Scan Results for ${url}**\n\`\`\`\n${result}\`\`\``);
    
            if (loggingActive) {
                await fetch(config.webhookUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        content: `🔍 SQL scan performed by ${message.author.tag}\nTarget: ${url}\nServer: ${message.guild ? message.guild.name : 'Private Messages'}`
                    }),
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        });
    }
    

    if (message.content.startsWith('+antigroup')) {
        const args = message.content.split(' ');
        if (args.length === 1) {
            await message.reply('Please specify "on" or "off".');
        } else if (args[1] === 'on') {
            if (antiGroupActive) {
                await message.reply('Anti-group is already active.');
            } else {
                antiGroupActive = true;
                await message.reply('Anti-group enabled.');
            }
        } else if (args[1] === 'off') {
            if (!antiGroupActive) {
                await message.reply('Anti-group is already disabled.');
            } else {
                antiGroupActive = false;
                await message.reply('Anti-group disabled.');
            }
        } else {
            await message.reply('Invalid option. Please specify "on" or "off".');
        }
    }

    if (message.content.startsWith('+linkbp')) {
        const args = message.content.split(' ');
        if (args.length === 1) {
            await message.reply('Please specify "on" or "off".');
            return;
        }
        if (args[1] === 'on') {
            if (linkBypassActive) {
                await message.reply('Link bypass is already active.');
            } else {
                linkBypassActive = true;
                console.log(`[LINKBP] Link bypass enabled by ${message.author.tag}`);
                await message.reply('Link bypass enabled.');
            }
        } else if (args[1] === 'off') {
            if (!linkBypassActive) {
                await message.reply('Link bypass is already disabled.');
            } else {
                linkBypassActive = false;
                console.log(`[LINKBP] Link bypass disabled by ${message.author.tag}`);
                await message.reply('Link bypass disabled.');
            }
        } else {
            await message.reply('Invalid option. Please specify "on" or "off".');
        }
    }
    
    if (linkBypassActive && message.author.id === client.user.id && message.content.includes('http')) {
        const links = message.content.match(/(https?:\/\/[^\s]+)/g);
        if (links) {
            links.forEach(async (link) => {
                const processedLink = processLink(link);
                await message.reply(processedLink);
            });
        }
    }

    if (message.content.startsWith('+afk')) {
        const args = message.content.split(' ');
        if (args.length === 1) {
            await message.reply('Please specify "on" or "off".');
            return;
        }
        if (args[1] === 'on') {
            if (afkActive) {
                await message.reply('AFK status is already active.');
            } else {
                afkActive = true;
                console.log(`[AFK] AFK mode enabled by ${message.author.tag}`);
                await message.reply('AFK mode enabled.');
            }
        } else if (args[1] === 'off') {
            if (!afkActive) {
                await message.reply('AFK status is already disabled.');
            } else {
                afkActive = false;
                console.log(`[AFK] AFK mode disabled by ${message.author.tag}`);
                await message.reply('AFK mode disabled.');
            }
        } else {
            await message.reply('Invalid option. Please specify "on" or "off".');
        }
    }
    
    if (message.content.startsWith('+busy')) {
        const args = message.content.split(' ');
        if (args.length === 1) {
            await message.reply('Please specify "on" or "off".');
            return;
        }
        if (args[1] === 'on') {
            if (busyActive) {
                await message.reply('Busy status is already active.');
            } else {
                busyActive = true;
                console.log(`[BUSY] Busy mode enabled by ${message.author.tag}`);
                await message.reply('Busy mode enabled.');
            }
        } else if (args[1] === 'off') {
            if (!busyActive) {
                await message.reply('Busy status is already disabled.');
            } else {
                busyActive = false;
                console.log(`[BUSY] Busy mode disabled by ${message.author.tag}`);
                await message.reply('Busy mode disabled.');
            }
        } else {
            await message.reply('Invalid option. Please specify "on" or "off".');
        }
    }
    
    if (message.content.startsWith('+offline')) {
        const args = message.content.split(' ');
        if (args.length === 1) {
            await message.reply('Please specify "on" or "off".');
            return;
        }
        if (args[1] === 'on') {
            if (offlineActive) {
                await message.reply('Offline status is already active.');
            } else {
                offlineActive = true;
                console.log(`[OFFLINE] Offline mode enabled by ${message.author.tag}`);
                await message.reply('Offline mode enabled.');
            }
        } else if (args[1] === 'off') {
            if (!offlineActive) {
                await message.reply('Offline status is already disabled.');
            } else {
                offlineActive = false;
                console.log(`[OFFLINE] Offline mode disabled by ${message.author.tag}`);
                await message.reply('Offline mode disabled.');
            }
        } else {
            await message.reply('Invalid option. Please specify "on" or "off".');
        }
    }

    if (message.channel.type === 'DM' && message.author.id !== client.user.id) {
        if (afkActive) {
            await message.reply('I am currently AFK <:sigmaping:1303490888047267903>. I will respond as soon as I am back online.');
        } else if (busyActive) {
            await message.reply('I am currently busy <:busy:1309709146886770739> and cannot respond at the moment. Please try to reach me later or in my <:instagram:1303489752011509861> [instagram](https://instagram.com/kenzis2rich/).');
        } else if (offlineActive) {
            await message.reply('I am currently offline <:cross:1303488940694831125>. No need to try to reach me, I am either outside <:outside:1309708480038437025> or having a meal <:fatchad:1303491003927363594>');
        }
    }

    if (message.content.startsWith('+purge')) {
        console.log(`Command executed: ${message.content} by ${message.author.tag}`);
        const args = message.content.split(' ');
        if (args.length !== 2 || isNaN(args[1])) {
            await message.channel.reply('Please specify a valid number of messages to delete.');
            return;
        }
    
        const amount = parseInt(args[1]);
        if (amount < 1 || amount > 100) {
            await message.channel.reply('Please specify a number between 1 and 100.');
            return;
        }
    
        try {
            const messages = await message.channel.messages.fetch({ limit: amount });
            const deleteCount = messages.size;
    
            messages.forEach(async msg => {
                try {
                    await msg.delete();
                } catch (error) {
                    console.error('Error deleting message:', error);
                }
            });
    
            const response = await message.channel.send(`Deleted ${deleteCount} messages.`);
            setTimeout(() => response.delete().catch(() => {}), 3000);
    
            if (loggingActive) {
                const embed = new MessageEmbed()
                    .setColor('#000000')
                    .setTitle('Messages Purged')
                    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                    .addFields(
                        { name: 'Server', value: `${message.guild ? message.guild.name : 'Private Messages'} (${message.guild ? message.guild.id : 'N/A'})`, inline: false },
                        { name: 'Channel', value: message.channel.name || 'DM', inline: true },
                        { name: 'Amount', value: deleteCount.toString(), inline: true }
                    )
                    .setTimestamp();
    
                await fetch(config.webhookUrl, {
                    method: 'POST',
                    body: JSON.stringify({ embeds: [embed] }),
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        } catch (error) {
            console.error('Purge error:', error);
            await message.channel.send('❌ An error occurred while deleting messages.');
        }
    }

    if (message.content.startsWith('+geo')) {
        const args = message.content.split(' ');

        if (args.length !== 2) {
            await message.reply('❌ Please specify a valid IP address.');
            return;
        }

        const ip = args[1];
        console.log(`Command executed: +geo ${ip} by ${message.author.tag}`);
        const location = await getIpLocation(ip)
        if (!location) {
            await message.reply('❌ Could not locate the specified IP address.');
            return;
        }

        if (!location.ip || !location.country || !location.city || !location.region || !location.isp) {
            await message.reply('❌ Incomplete geolocation information received.');
            return;
        }

        const geoMessage = `📍 **IP Geolocation Results**\n` +
            `🌐 **IP:** ${location.ip}\n` +
            `🌍 **Country:** ${location.country}\n` +
            `🏙️ **City:** ${location.city}\n` +
            `📍 **Region:** ${location.region}\n` +
            `🏢 **ISP:** ${location.isp}`;

        try {
            await message.reply(geoMessage);

            if (loggingActive) {
                const logMessage = `IP Lookup Performed by ${message.author.tag}\n` +
                    `Server: ${message.guild ? message.guild.name : 'Private Messages'} (${message.guild ? message.guild.id : 'N/A'})\n` +
                    `IP Looked Up: ${ip}`;

                await fetch(config.webhookUrl, {
                    method: 'POST',
                    body: JSON.stringify({ content: logMessage }),
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        } catch (error) {
            console.error('Geolocation error:', error);
            await message.reply('❌ An error occurred while fetching IP information.');
        }
    }

    if (message.content.startsWith('+phone')) {
        const args = message.content.split(' ');
    
        if (args.length !== 2) {
            await message.reply('❌ Please specify a valid phone number.');
            return;
        }
    
        const phoneNumber = args[1];
        console.log(`Command executed: +phone ${phoneNumber} by ${message.author.tag}`);
        const infoMessage = await num_info(phoneNumber);
        await message.reply(infoMessage);
    }

    if (message.content === '+socials') {
        const socialsMessage = `**🌐 Social Media Links**\n` +
            `- <:tiktok:1303489229644632146> [TikTok](https://www.tiktok.com/@kenzis2rich/) \n` +
            `- <:instagram:1303489752011509861> [instagram](https://instagram.com/kenzis2rich/) \n` +
            `- <:website:1303489875168727093> [Website](https://kenzis2rich.com/) \n` +
            `- <:gunslol:1303247194517934081> [guns.lol](https://guns.lol/kenzi)`;
    
        await message.reply(socialsMessage);
    }
});

client.login(token);