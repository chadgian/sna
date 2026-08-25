import os
import tempfile
import unittest
import app as sna


class SocialNetworkApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(delete=False)
        self.tmp.close()
        self.original_db = sna.DB_PATH
        sna.DB_PATH = self.tmp.name
        sna.init_db()
        sna.app.config.update(TESTING=True)
        self.client = sna.app.test_client()

    def tearDown(self):
        sna.DB_PATH = self.original_db
        os.unlink(self.tmp.name)

    def test_seed_graph_and_summary(self):
        graph = self.client.get('/api/graph')
        self.assertEqual(graph.status_code, 200)
        data = graph.get_json()
        self.assertGreaterEqual(len(data['nodes']), 8)
        self.assertGreaterEqual(len(data['edges']), 8)
        summary = self.client.get('/api/analysis/summary').get_json()
        self.assertEqual(summary['users'], 8)

    def test_add_user_and_friendship(self):
        new_user = self.client.post('/api/users', json={'name':'Ivy'})
        self.assertEqual(new_user.status_code, 201)
        ivy_id = new_user.get_json()['id']
        users = self.client.get('/api/users').get_json()
        anna_id = next(u['id'] for u in users if u['name'] == 'Anna')
        result = self.client.post('/api/friendships', json={'user1_id':ivy_id,'user2_id':anna_id})
        self.assertEqual(result.status_code, 201)
        path = self.client.get(f'/api/analysis/path/{ivy_id}/{anna_id}').get_json()
        self.assertEqual(path['degrees_of_separation'], 1)

    def test_mutual_friends(self):
        users = self.client.get('/api/users').get_json()
        ids = {u['name']:u['id'] for u in users}
        result = self.client.get(f"/api/analysis/mutual/{ids['Anna']}/{ids['Dana']}").get_json()
        self.assertEqual({u['name'] for u in result}, {'Ben','Carlo'})


if __name__ == '__main__':
    unittest.main()
