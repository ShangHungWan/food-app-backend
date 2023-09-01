import random, string

print("".join(random.choice(string.ascii_letters + string.digits) for x in range(64)))
