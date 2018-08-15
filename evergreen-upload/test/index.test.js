const index = require('../index');

describe('Function', () => {
  it('should be an Azure ready function', () => {
    expect(index).toBeTruthy();
  });
});
