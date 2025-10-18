export type ZkPool = {
  address: string;
  metadata: {
    name: 'zk_pool';
    version: '0.1.0';
  };
  instructions: [
    {
      name: 'submitShield';
      accounts: [
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'vkAccount';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'user';
          isMut: false;
          isSigner: true;
        },
      ];
      args: [
        {
          name: 'proof';
          type: 'bytes';
        },
        {
          name: 'publicInputs';
          type: {
            vec: {
              array: ['u8', 32];
            };
          };
        },
      ];
    },
  ];
};

export const IDL: ZkPool = {
  address: 'Hza5rjYmJnoYsjsgsuxLkyxLoWVo6RCUZxCB3x17v8qz',
  metadata: {
    name: 'zk_pool',
    version: '0.1.0',
  },
  instructions: [
    {
      name: 'submitShield',
      accounts: [
        {
          name: 'config',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'vkAccount',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'user',
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: 'proof',
          type: 'bytes',
        },
        {
          name: 'publicInputs',
          type: {
            vec: {
              array: ['u8', 32],
            },
          },
        },
      ],
    },
  ],
};
