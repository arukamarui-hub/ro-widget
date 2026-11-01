const DA_TOKEN = 'g3jhLKjGSkALHklZX3VVOZBTjk1eLpfsilsUoJTU'; 
const TWITCH_CHANNEL = 'arukosama'; 
const MAX_GOAL = 15000;             
const TOP_LIMIT = 11;               

let cacheChatters = [];
let currentStreamerGoalAmount = 0; 
let donorsData = {}; 

window.addEventListener('DOMContentLoaded', () => {
    updateStreamerGoal(currentStreamerGoalAmount);
    initDonationAlertsWS();
    checkTwitchChatters();
    setInterval(checkTwitchChatters, 30000);
});

function updateStreamerGoal(current) {
    const bar = document.getElementById('streamerBar');
    const text = document.getElementById('streamerGoalText');
    if (bar && text) {
        let displayCurrent = Math.floor(current);
        if (displayCurrent < 1) displayCurrent = 1;
        let percent = (displayCurrent / MAX_GOAL) * 100;
        if (percent > 100) percent = 100;
        if (percent < 5) percent = 5; 
        bar.style.width = percent + '%';
        text.innerText = displayCurrent + '/' + MAX_GOAL;
    }
}

function renderPartyMembers() {
    const container = document.getElementById('partyListContainer');
    const oldSlots = container.querySelectorAll('.donor-slot');
    oldSlots.forEach(slot => slot.remove());

    const sortedDonors = Object.entries(donorsData)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, TOP_LIMIT);

    sortedDonors.forEach(donor => {
        const amount = parseFloat(donor.amount) || 0;
        const maxHp = 15000; 
        let level = 1;
        if (amount <= 150) {
            level = 1;
        } else if (amount >= maxHp) {
            level = 99;
        } else {
            level = 1 + Math.floor(((amount - 150) / (maxHp - 150)) * (99 - 1));
        }

        let hpPercent = (amount / maxHp) * 100;
        if (hpPercent > 100) hpPercent = 100;
        if (hpPercent < 5) hpPercent = 5; 

        const isOnline = cacheChatters.includes(donor.name.toLowerCase());
        const statusClass = isOnline ? 'status-on' : 'status-off';
        const statusText = isOnline ? 'ON' : '';
        const offlineRowClass = isOnline ? '' : ' is-offline';

        const memberDiv = document.createElement('div');
        memberDiv.className = `party-member donor-slot${offlineRowClass}`; 
        memberDiv.id = `donor-${donor.name.toLowerCase()}`;
        memberDiv.setAttribute('data-username', donor.name);

        memberDiv.innerHTML = `
          <div class="party-status-icon ${statusClass}">${statusText}</div>
          <div class="party-info">
            <div class="party-name-row">
              <span class="username">${donor.name}</span>
              <span class="level-badge">Lv ${level}</span>
            </div>
            <div class="hp-container">
              <div class="hp-bar-wrapper">
                <div class="hp-bar donor-hp" style="width: ${hpPercent}%;"></div>
              </div>
              <span class="hp-text">${Math.floor(amount)}/${maxHp}</span>
            </div>
          </div>
        `;
        container.appendChild(memberDiv);
    });
}

function initDonationAlertsWS() {
    const userId = "2919934"; 
    fetch('https://www.donationalerts.com/api/v1/centrifuge/subscribe', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${DA_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ channels: [`$alerts:donation_${userId}`] })
    })
    .then(res => res.json())
    .then(data => {
        const socket = new WebSocket('wss://centrifugo.donationalerts.com/connection/websocket');
        socket.onopen = () => {
            socket.send(JSON.stringify({ params: { token: data.token }, id: 1 }));
        };
        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.id === 1 && msg.result && msg.result.client) {
                socket.send(JSON.stringify({
                    method: "subscribe",
                    params: { channel: data.channels[0].channel, token: data.channels[0].token },
                    id: 2
                }));
            }
            if (msg.result && msg.result.data && msg.result.data.data) {
                const donation = msg.result.data.data;
                handleNewDonation(donation.username, parseFloat(donation.amount));
            }
        };
        socket.onclose = () => { setTimeout(initDonationAlertsWS, 5000); };
    })
    .catch(err => console.error(err));
}

function handleNewDonation(username, amount) {
    if (!username || isNaN(amount)) return;
    currentStreamerGoalAmount += amount;
    updateStreamerGoal(currentStreamerGoalAmount);
    const lowerName = username.toLowerCase();
    let realName = username;
    for (let key in donorsData) {
        if (key.toLowerCase() === lowerName) { realName = key; break; }
    }
    donorsData[realName] = (donorsData[realName] || 0) + amount;
    renderPartyMembers();
}

function checkTwitchChatters() {
    fetch(`https://decapi.me/twitch/chatters/${TWITCH_CHANNEL.toLowerCase()}`)
        .then(res => res.text())
        .then(text => {
            if (text) {
                cacheChatters = text.split('\n').map(name => name.trim().toLowerCase());
                const slots = document.querySelectorAll('.donor-slot');
                slots.forEach(slot => {
                    const donorName = slot.getAttribute('data-username').toLowerCase();
                    const icon = slot.querySelector('.party-status-icon');
                    if (cacheChatters.includes(donorName)) {
                        slot.classList.remove('is-offline');
                        icon.className = 'party-status-icon status-on';
                        icon.innerText = 'ON';
                    } else {
                        slot.classList.add('is-offline');
                        icon.className = 'party-status-icon status-off';
                        icon.innerText = '';
                    }
                });
            }
        })
        .catch(err => console.error(err));
}