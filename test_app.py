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

    def test_profile_fields_and_interests(self):
        created = self.client.post('/api/users', json={
            'name':'Ivy',
            'age_group':'18-24',
            'hometown':'Manila',
            'occupation':'Student',
            'bio':'Interested in software and design.',
            'interests':['Coding','Music','Coding']
        })
        self.assertEqual(created.status_code, 201)
        profile = created.get_json()
        self.assertEqual(profile['hometown'], 'Manila')
        self.assertEqual(set(profile['interests']), {'Coding','Music'})

        updated = self.client.put(f"/api/users/{profile['id']}", json={
            'name':'Ivy',
            'age_group':'18-24',
            'hometown':'Quezon City',
            'occupation':'Graduate Student',
            'bio':'Updated bio',
            'interests':['Artificial Intelligence','Reading']
        })
        self.assertEqual(updated.status_code, 200)
        profile = updated.get_json()
        self.assertEqual(profile['hometown'], 'Quezon City')
        self.assertEqual(set(profile['interests']), {'Artificial Intelligence','Reading'})

    def test_friend_suggestions_use_profile_similarity_and_exclude_friends(self):
        ivy = self.client.post('/api/users', json={
            'name':'Ivy',
            'age_group':'18-24',
            'hometown':'Manila',
            'occupation':'Student',
            'interests':['Coding','Music']
        }).get_json()

        suggestions = self.client.get(f"/api/analysis/suggestions/{ivy['id']}")
        self.assertEqual(suggestions.status_code, 200)
        items = suggestions.get_json()
        self.assertTrue(items)
        self.assertEqual(items[0]['name'], 'Anna')
        self.assertIn('Coding', items[0]['shared_interests'])

        anna_id = items[0]['id']
        self.client.post('/api/friendships', json={
            'user1_id':ivy['id'],
            'user2_id':anna_id
        })
        after = self.client.get(f"/api/analysis/suggestions/{ivy['id']}").get_json()
        self.assertNotIn(anna_id, {x['id'] for x in after})


if __name__ == '__main__':
    unittest.main()
