const { Command } = require('discord-akairo');
const { MessageEmbed } = require('discord.js');
const { stripIndents } = require('common-tags');

const ACTIONS = {
	BAN: 1,
	UNBAN: 2,
	SOFTBAN: 3,
	KICK: 4,
	MUTE: 5,
	EMBED: 6,
	EMOJI: 7,
	REACTION: 8
};

class SoftbanCommand extends Command {
	constructor() {
		super('softban', {
			aliases: ['softban'],
			category: 'mod',
			description: {
				content: '.',
				usage: '<member> <...reason>',
				examples: ['softban @Crawl']
			},
			channel: 'guild',
			clientPermissions: ['MANAGE_ROLES'],
			ratelimit: 2,
			args: [
				{
					id: 'member',
					type: 'member',
					prompt: {
						start: message => `${message.author}, what member do you want to softban?`,
						retry: message => `${message.author}, please mention a member.`
					}
				},
				{
					'id': 'reason',
					'match': 'rest',
					'type': 'string',
					'default': ''
				}
			]
		});
	}

	async exec(message, { member, reason }) {
		const staffRole = message.member.roles.has(this.client.settings.get(message.guild, 'modRole'));
		if (!staffRole) return message.util.send('You know, I know, we should just leave it at that.');
		if (member.roles.has(staffRole)) {
			return message.util.send('Nuh-uh! You know you can\'t do this.');
		}

		const keys = [`${message.guild.id}:${member.id}:BAN`, `${message.guild.id}:${member.id}:UNBAN`];
		if (this.client._cachedCases.has(keys[0]) && this.client._cachedCases.has(keys[1])) {
			return message.util.send('That user is currently being moderated by someone else.');
		}
		this.client._cachedCases.add(keys[0]);
		this.client._cachedCases.add(keys[1]);

		await member.ban(`Softbanned by ${message.author.tag}`);
		await message.guild.members.unban(member, `Softbanned by ${message.author.tag}`);

		const totalCases = this.client.settings.get(message.guild, 'caseTotal', 0) + 1;
		this.client.settings.set(message.guild, 'caseTotal', totalCases);

		if (!reason) {
			const prefix = this.handler.prefix(message);
			reason = `Use \`${prefix}reason ${totalCases} <...reason>\` to set a reason for this case`;
		}

		const modLogChannel = this.client.settings.get(message.guild, 'modLogChannel');
		let modMessage;
		if (modLogChannel) {
			const embed = new MessageEmbed()
				.setAuthor(message.author.tag, message.author.displayAvatarURL())
				.setDescription(stripIndents`
					**Member:** ${member.user.tag} (${member.id})
					**Action:** Softban
					**Reason:** ${reason}
				`)
				.setFooter(`Case ${totalCases}`)
				.setTimestamp(new Date());
			modMessage = await this.client.channels.get(modLogChannel).send(embed);
		}
		await this.client.db.models.cases.create({
			guild: message.guild.id,
			message: modMessage ? modMessage.id : null,
			case_id: totalCases,
			target_id: member.id,
			target_tag: member.user.tag,
			mod_id: message.author.id,
			mod_tag: message.author.tag,
			action: ACTIONS.SOFTBAN,
			reason
		});

		return message.util.send(`Successfully softbanned ${member.user.tag}`);
	}
}

module.exports = SoftbanCommand;