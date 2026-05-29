const BOARD_SPACES = [
  { id: 0,  name: "GO",                  type: "go" },
  { id: 1,  name: "Mediterranean Ave",   type: "property", color: "brown",    price: 60,  rent: [2,10,30,90,160,250],   houseCost: 50,  mortgage: 30 },
  { id: 2,  name: "Community Chest",     type: "community_chest" },
  { id: 3,  name: "Baltic Avenue",       type: "property", color: "brown",    price: 60,  rent: [4,20,60,180,320,450],   houseCost: 50,  mortgage: 30 },
  { id: 4,  name: "Income Tax",          type: "tax",      amount: 200 },
  { id: 5,  name: "Reading Railroad",    type: "railroad", price: 200, rent: [25,50,100,200], mortgage: 100 },
  { id: 6,  name: "Oriental Avenue",     type: "property", color: "lightblue", price: 100, rent: [6,30,90,270,400,550],  houseCost: 50,  mortgage: 50 },
  { id: 7,  name: "Chance",              type: "chance" },
  { id: 8,  name: "Vermont Avenue",      type: "property", color: "lightblue", price: 100, rent: [6,30,90,270,400,550],  houseCost: 50,  mortgage: 50 },
  { id: 9,  name: "Connecticut Avenue",  type: "property", color: "lightblue", price: 120, rent: [8,40,100,300,450,600], houseCost: 50,  mortgage: 60 },
  { id: 10, name: "Jail / Just Visiting",type: "jail" },
  { id: 11, name: "St. Charles Place",   type: "property", color: "pink",      price: 140, rent: [10,50,150,450,625,750],houseCost: 100, mortgage: 70 },
  { id: 12, name: "Electric Company",    type: "utility",  price: 150, mortgage: 75 },
  { id: 13, name: "States Avenue",       type: "property", color: "pink",      price: 140, rent: [10,50,150,450,625,750],houseCost: 100, mortgage: 70 },
  { id: 14, name: "Virginia Avenue",     type: "property", color: "pink",      price: 160, rent: [12,60,180,500,700,900],houseCost: 100, mortgage: 80 },
  { id: 15, name: "Pennsylvania Railroad",type: "railroad",price: 200, rent: [25,50,100,200], mortgage: 100 },
  { id: 16, name: "St. James Place",     type: "property", color: "orange",    price: 180, rent: [14,70,200,550,750,950],houseCost: 100, mortgage: 90 },
  { id: 17, name: "Community Chest",     type: "community_chest" },
  { id: 18, name: "Tennessee Avenue",    type: "property", color: "orange",    price: 180, rent: [14,70,200,550,750,950],houseCost: 100, mortgage: 90 },
  { id: 19, name: "New York Avenue",     type: "property", color: "orange",    price: 200, rent: [16,80,220,600,800,1000],houseCost:100, mortgage: 100 },
  { id: 20, name: "Free Parking",        type: "free_parking" },
  { id: 21, name: "Kentucky Avenue",     type: "property", color: "red",       price: 220, rent: [18,90,250,700,875,1050],houseCost:150, mortgage: 110 },
  { id: 22, name: "Chance",              type: "chance" },
  { id: 23, name: "Indiana Avenue",      type: "property", color: "red",       price: 220, rent: [18,90,250,700,875,1050],houseCost:150, mortgage: 110 },
  { id: 24, name: "Illinois Avenue",     type: "property", color: "red",       price: 240, rent: [20,100,300,750,925,1100],houseCost:150, mortgage: 120 },
  { id: 25, name: "B&O Railroad",        type: "railroad", price: 200, rent: [25,50,100,200], mortgage: 100 },
  { id: 26, name: "Atlantic Avenue",     type: "property", color: "yellow",    price: 260, rent: [22,110,330,800,975,1150],houseCost:150, mortgage: 130 },
  { id: 27, name: "Ventnor Avenue",      type: "property", color: "yellow",    price: 260, rent: [22,110,330,800,975,1150],houseCost:150, mortgage: 130 },
  { id: 28, name: "Water Works",         type: "utility",  price: 150, mortgage: 75 },
  { id: 29, name: "Marvin Gardens",      type: "property", color: "yellow",    price: 280, rent: [24,120,360,850,1025,1200],houseCost:150, mortgage: 140 },
  { id: 30, name: "Go To Jail",          type: "go_to_jail" },
  { id: 31, name: "Pacific Avenue",      type: "property", color: "green",     price: 300, rent: [26,130,390,900,1100,1275],houseCost:200, mortgage: 150 },
  { id: 32, name: "North Carolina Ave",  type: "property", color: "green",     price: 300, rent: [26,130,390,900,1100,1275],houseCost:200, mortgage: 150 },
  { id: 33, name: "Community Chest",     type: "community_chest" },
  { id: 34, name: "Pennsylvania Avenue", type: "property", color: "green",     price: 320, rent: [28,150,450,1000,1200,1400],houseCost:200, mortgage: 160 },
  { id: 35, name: "Short Line Railroad", type: "railroad", price: 200, rent: [25,50,100,200], mortgage: 100 },
  { id: 36, name: "Chance",              type: "chance" },
  { id: 37, name: "Park Place",          type: "property", color: "darkblue",  price: 350, rent: [35,175,500,1100,1300,1500],houseCost:200, mortgage: 175 },
  { id: 38, name: "Luxury Tax",          type: "tax",      amount: 100 },
  { id: 39, name: "Boardwalk",           type: "property", color: "darkblue",  price: 400, rent: [50,200,600,1400,1700,2000],houseCost:200, mortgage: 200 }
];

const CHANCE_CARDS = [
  { id: 'ch1',  text: "Advance to GO. Collect $200.",          action: { type: 'move_to', position: 0, collect_go: true } },
  { id: 'ch2',  text: "Advance to Illinois Avenue.",           action: { type: 'move_to', position: 24, collect_go: true } },
  { id: 'ch3',  text: "Advance to St. Charles Place.",        action: { type: 'move_to', position: 11, collect_go: true } },
  { id: 'ch4',  text: "Advance to nearest Railroad.",         action: { type: 'nearest_railroad' } },
  { id: 'ch5',  text: "Advance to nearest Railroad.",         action: { type: 'nearest_railroad' } },
  { id: 'ch6',  text: "Advance to nearest Utility.",          action: { type: 'nearest_utility' } },
  { id: 'ch7',  text: "Bank pays you dividend of $50.",       action: { type: 'gain', amount: 50 } },
  { id: 'ch8',  text: "Get Out of Jail Free.",                action: { type: 'get_out_of_jail' } },
  { id: 'ch9',  text: "Go Back 3 Spaces.",                    action: { type: 'move_relative', amount: -3 } },
  { id: 'ch10', text: "Go to Jail!",                          action: { type: 'go_to_jail' } },
  { id: 'ch11', text: "Make general repairs: $25/house, $100/hotel.", action: { type: 'repairs', house: 25, hotel: 100 } },
  { id: 'ch12', text: "Pay poor tax of $15.",                 action: { type: 'lose', amount: 15 } },
  { id: 'ch13', text: "Take a trip to Reading Railroad.",     action: { type: 'move_to', position: 5, collect_go: true } },
  { id: 'ch14', text: "Take a walk on the Boardwalk.",        action: { type: 'move_to', position: 39, collect_go: false } },
  { id: 'ch15', text: "You have been elected Chairman. Pay each player $50.", action: { type: 'pay_each_player', amount: 50 } },
  { id: 'ch16', text: "Your building loan matures. Collect $150.", action: { type: 'gain', amount: 150 } }
];

const COMMUNITY_CHEST_CARDS = [
  { id: 'cc1',  text: "Advance to GO. Collect $200.",         action: { type: 'move_to', position: 0, collect_go: true } },
  { id: 'cc2',  text: "Bank error in your favor. Collect $200.", action: { type: 'gain', amount: 200 } },
  { id: 'cc3',  text: "Doctor's fee. Pay $50.",               action: { type: 'lose', amount: 50 } },
  { id: 'cc4',  text: "From sale of stock, collect $50.",     action: { type: 'gain', amount: 50 } },
  { id: 'cc5',  text: "Get Out of Jail Free.",                action: { type: 'get_out_of_jail' } },
  { id: 'cc6',  text: "Go to Jail!",                          action: { type: 'go_to_jail' } },
  { id: 'cc7',  text: "Holiday fund matures. Receive $100.",  action: { type: 'gain', amount: 100 } },
  { id: 'cc8',  text: "Income tax refund. Collect $20.",      action: { type: 'gain', amount: 20 } },
  { id: 'cc9',  text: "It's your birthday! Collect $10 from every player.", action: { type: 'collect_from_each', amount: 10 } },
  { id: 'cc10', text: "Life insurance matures. Collect $100.",action: { type: 'gain', amount: 100 } },
  { id: 'cc11', text: "Pay hospital fees of $100.",           action: { type: 'lose', amount: 100 } },
  { id: 'cc12', text: "Pay school fees of $150.",             action: { type: 'lose', amount: 150 } },
  { id: 'cc13', text: "Receive $25 consultancy fee.",         action: { type: 'gain', amount: 25 } },
  { id: 'cc14', text: "You are assessed for street repairs: $40/house, $115/hotel.", action: { type: 'repairs', house: 40, hotel: 115 } },
  { id: 'cc15', text: "You have won second prize in a beauty contest. Collect $10.", action: { type: 'gain', amount: 10 } },
  { id: 'cc16', text: "You inherit $100.",                    action: { type: 'gain', amount: 100 } }
];

const COLOR_GROUPS = {
  brown:    [1, 3],
  lightblue:[6, 8, 9],
  pink:     [11, 13, 14],
  orange:   [16, 18, 19],
  red:      [21, 23, 24],
  yellow:   [26, 27, 29],
  green:    [31, 32, 34],
  darkblue: [37, 39]
};

const PLAYER_TOKENS = ['🎩','🚂','🛳️','🚗','🐕','🎠','🥾','🧲'];

module.exports = { BOARD_SPACES, CHANCE_CARDS, COMMUNITY_CHEST_CARDS, COLOR_GROUPS, PLAYER_TOKENS };
